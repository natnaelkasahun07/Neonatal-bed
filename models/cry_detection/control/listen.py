#!/usr/bin/env python3
"""
Standalone cry / babbling / laughing detector for your minimized OpenBabyMonitor folder.

Your folder structure must be:

cry_detector/
├── control/
│   ├── config.py
│   ├── listen.py                  <-- this file
│   ├── mic.py
│   ├── crynet_large.onnx
│   ├── crynet_small.onnx
│   └── standardization.npz
└── detection/
    ├── features.py
    └── librosa_destilled.py


Run from the cry_detector folder:

    python3 control/listen.py --list-devices

Then run using your USB microphone device, example:

    python3 control/listen.py --device plughw:1,0 --model small

Run only one test:

    python3 control/listen.py --device plughw:1,0 --model small --once
"""

from __future__ import annotations

import argparse
import collections
import json
import re
import subprocess
import sys
import time
from pathlib import Path
from typing import Dict, List, Optional

import cv2
import numpy as np


# ============================================================
# Folder paths for your exact structure
# ============================================================

CONTROL_DIR = Path(__file__).resolve().parent
PROJECT_DIR = CONTROL_DIR.parent
DETECTION_DIR = PROJECT_DIR / "detection"

CRYNET_SMALL = CONTROL_DIR / "crynet_small.onnx"
CRYNET_LARGE = CONTROL_DIR / "crynet_large.onnx"
STANDARDIZATION_FILE = CONTROL_DIR / "standardization.npz"

# features.py imports librosa_destilled directly, so detection/ must be in sys.path
sys.path.insert(0, str(DETECTION_DIR))

try:
    import features
except Exception as exc:
    raise SystemExit(
        "\nERROR: Could not import detection/features.py.\n\n"
        "Your folder must look like this:\n\n"
        "cry_detector/\n"
        "├── control/\n"
        "│   └── listen.py\n"
        "└── detection/\n"
        "    ├── features.py\n"
        "    └── librosa_destilled.py\n\n"
        f"Original error: {exc}\n"
    )


# ============================================================
# Model settings
# ============================================================

INPUT_SHAPE = (64, 128)

LABEL_NAMES: Dict[int, str] = {
    0: "ambient",
    1: "bad",
    2: "good",
}

# Project-friendly labels
DISPLAY_LABELS: Dict[str, str] = {
    "ambient": "ambient",
    "bad": "crying",
    "good": "babbling_or_laughing",
}


# ============================================================
# Microphone / ALSA helper functions
# ============================================================

def get_arecord_devices() -> List[Dict[str, str]]:
    """
    Uses `arecord -l` to detect microphones.

    Example returned ALSA device:
        plughw:1,0
    """
    try:
        output = subprocess.check_output(
            ["arecord", "-l"],
            text=True,
            stderr=subprocess.STDOUT,
        )
    except FileNotFoundError:
        raise SystemExit(
            "\nERROR: arecord is not installed.\n\n"
            "Install it using:\n"
            "sudo apt update\n"
            "sudo apt install -y alsa-utils\n"
        )
    except subprocess.CalledProcessError as exc:
        raise SystemExit(
            "\nERROR: Could not run arecord -l.\n\n"
            f"Output:\n{exc.output}\n"
        )

    pattern = r"^card\s+(\d+):\s+(.+?),\s+device\s+(\d+):\s+(.+?)$"
    matches = re.findall(pattern, output, flags=re.MULTILINE)

    devices: List[Dict[str, str]] = []

    for card, card_name, device, device_name in matches:
        devices.append(
            {
                "card": card,
                "device": device,
                "card_name": card_name.strip(),
                "device_name": device_name.strip(),
                "alsa_device": f"plughw:{card},{device}",
            }
        )

    return devices


def print_arecord_devices() -> None:
    devices = get_arecord_devices()

    if not devices:
        print("\nNo recording devices found.")
        print("Plug in your USB microphone, then run again:")
        print("python3 control/listen.py --list-devices\n")
        return

    print("\nAvailable recording devices:\n")

    for index, dev in enumerate(devices):
        print(
            f"[{index}] {dev['alsa_device']} | "
            f"card {dev['card']}: {dev['card_name']} | "
            f"device {dev['device']}: {dev['device_name']}"
        )

    print("\nUse one of them like this:")
    print("python3 control/listen.py --device plughw:1,0 --model small\n")


def choose_audio_device(user_device: Optional[str]) -> str:
    if user_device:
        return user_device

    devices = get_arecord_devices()

    if not devices:
        raise SystemExit(
            "\nERROR: No recording microphone found.\n\n"
            "Check microphone using:\n"
            "arecord -l\n"
        )

    # Prefer USB mic if detected
    for dev in devices:
        combined_name = f"{dev['card_name']} {dev['device_name']}".lower()
        if "usb" in combined_name:
            selected = dev["alsa_device"]
            print(f"Auto-selected USB microphone: {selected}\n")
            return selected

    selected = devices[0]["alsa_device"]
    print(f"Auto-selected first microphone: {selected}")
    print("If this is wrong, run:")
    print("python3 control/listen.py --list-devices\n")
    return selected


# ============================================================
# ONNX model wrapper
# ============================================================

class CryNetONNX:
    def __init__(self, model_path: Path):
        if not model_path.exists():
            raise FileNotFoundError(f"Model file not found: {model_path}")

        self.model_path = model_path
        self.net = cv2.dnn.readNetFromONNX(str(model_path))

    def predict_probabilities(self, feature: Optional[np.ndarray]) -> Dict[str, float]:
        """
        Returns probabilities for:
            ambient
            bad
            good

        In this project:
            bad  = crying
            good = babbling_or_laughing
        """
        if feature is None:
            return {
                "ambient": 1.0,
                "bad": 0.0,
                "good": 0.0,
            }

        if feature.shape != INPUT_SHAPE:
            raise ValueError(
                f"Wrong feature shape. Expected {INPUT_SHAPE}, got {feature.shape}"
            )

        feature = feature.astype(np.float32, copy=False)
        input_blob = feature[np.newaxis, np.newaxis, :, :]

        self.net.setInput(input_blob)
        raw_output = self.net.forward().squeeze().astype(np.float64)

        # Original code uses: 10 ** output, then normalizes.
        # This is the same idea, but safer numerically.
        scores = np.power(10.0, raw_output - np.max(raw_output))
        probabilities = scores / np.sum(scores)

        return {
            LABEL_NAMES[index]: float(probabilities[index])
            for index in range(len(probabilities))
        }


# ============================================================
# Feature extraction
# ============================================================

def create_feature_extractor() -> features.AudioFeatureExtractor:
    return features.AudioFeatureExtractor(
        n_mel_bands=INPUT_SHAPE[0],
        feature_window_count=INPUT_SHAPE[1],
        backend="python_speech_features",
        disable_io=True,
    )


def create_feature_provider(
    audio_device: str,
    min_sound_contrast: float,
    background_offset: float,
    amplification: float,
) -> features.FeatureProvider:
    if not STANDARDIZATION_FILE.exists():
        raise FileNotFoundError(
            f"standardization.npz not found here: {STANDARDIZATION_FILE}"
        )

    return features.FeatureProvider(
        audio_device,
        create_feature_extractor(),
        min_sound_contrast=min_sound_contrast,
        background_loudness_level_offset=background_offset,
        amplification=amplification,
        standardization_file=STANDARDIZATION_FILE,
    )


# ============================================================
# Prediction smoothing and decision logic
# ============================================================

class DecisionSmoother:
    def __init__(self, history_size: int, fraction_threshold: float):
        self.history = collections.deque(maxlen=max(1, history_size))
        self.fraction_threshold = fraction_threshold

    def add(self, label: str) -> None:
        self.history.append(label)

    def fraction(self, target_label: str) -> float:
        if not self.history:
            return 0.0
        return self.history.count(target_label) / len(self.history)

    def result(self) -> str:
        if not self.history:
            return "ambient"

        if self.fraction("crying") >= self.fraction_threshold:
            return "crying"

        if self.fraction("babbling_or_laughing") >= self.fraction_threshold:
            return "babbling_or_laughing"

        return self.history[-1]


def make_decision(
    probabilities: Dict[str, float],
    probability_threshold: float,
) -> Dict[str, object]:
    raw_top_label = max(probabilities, key=probabilities.get)
    top_probability = probabilities[raw_top_label]

    if raw_top_label == "ambient":
        display_label = "ambient"
    elif top_probability >= probability_threshold:
        display_label = DISPLAY_LABELS[raw_top_label]
    else:
        display_label = "uncertain"

    return {
        "raw_top_label": raw_top_label,
        "display_label": display_label,
        "top_probability": float(top_probability),
        "cry_detected": display_label == "crying",
        "babbling_or_laughing_detected": display_label == "babbling_or_laughing",
    }


def write_latest_result(output_path: Path, result: Dict[str, object]) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(result, indent=2))


def percent(value: float) -> str:
    return f"{value * 100:5.1f}%"


# ============================================================
# Main detector loop
# ============================================================

def run_detector(args: argparse.Namespace) -> None:
    model_path = CRYNET_SMALL if args.model == "small" else CRYNET_LARGE

    if not model_path.exists():
        raise FileNotFoundError(f"Model file not found: {model_path}")

    if not STANDARDIZATION_FILE.exists():
        raise FileNotFoundError(
            f"standardization.npz not found: {STANDARDIZATION_FILE}"
        )

    audio_device = choose_audio_device(args.device)

    print("\nStarting standalone cry detector")
    print("--------------------------------")
    print(f"Project folder:      {PROJECT_DIR}")
    print(f"Control folder:      {CONTROL_DIR}")
    print(f"Detection folder:    {DETECTION_DIR}")
    print(f"Model:               {model_path}")
    print(f"Standardization:     {STANDARDIZATION_FILE}")
    print(f"Microphone:          {audio_device}")
    print(f"Interval:            {args.interval} seconds")
    print(f"Probability limit:   {args.probability_threshold}")
    print(f"Min sound contrast:  {args.min_sound_contrast} dB")
    print("--------------------------------\n")

    model = CryNetONNX(model_path)

    feature_provider = create_feature_provider(
        audio_device=audio_device,
        min_sound_contrast=args.min_sound_contrast,
        background_offset=args.background_offset,
        amplification=args.amplification,
    )

    smoother = DecisionSmoother(
        history_size=args.history_size,
        fraction_threshold=args.fraction_threshold,
    )

    output_path = Path(args.output_json)

    print("Listening... Press Ctrl+C to stop.\n")

    try:
        while True:
            loop_start = time.time()

            feature, bg_sound_level, signal_sound_level, record_time = feature_provider()

            probabilities = model.predict_probabilities(feature)

            decision = make_decision(
                probabilities=probabilities,
                probability_threshold=args.probability_threshold,
            )

            smoother.add(decision["display_label"])
            smoothed_label = smoother.result()

            result = {
                "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
                "model": args.model,
                "audio_device": audio_device,

                "label": decision["display_label"],
                "smoothed_label": smoothed_label,

                "cry_detected": smoothed_label == "crying",
                "babbling_or_laughing_detected": smoothed_label == "babbling_or_laughing",

                "raw_top_label": decision["raw_top_label"],
                "top_probability": decision["top_probability"],

                "probabilities": {
                    "ambient": probabilities["ambient"],
                    "crying": probabilities["bad"],
                    "babbling_or_laughing": probabilities["good"],
                },

                "sound": {
                    "background_level_db": float(bg_sound_level),
                    "contrast_over_background_db": float(signal_sound_level),
                    "record_time_seconds": float(record_time),
                    "min_sound_contrast_db": float(args.min_sound_contrast),
                },
            }

            write_latest_result(output_path, result)

            print(
                f"{result['timestamp']} | "
                f"label={result['label']:<22} | "
                f"smooth={result['smoothed_label']:<22} | "
                f"ambient={percent(probabilities['ambient'])} | "
                f"cry={percent(probabilities['bad'])} | "
                f"babble/laugh={percent(probabilities['good'])} | "
                f"sound_contrast={signal_sound_level:6.2f} dB"
            )

            if args.once:
                print(f"\nSaved result to: {output_path}")
                break

            elapsed = time.time() - loop_start
            time.sleep(max(0.0, args.interval - elapsed))

    except KeyboardInterrupt:
        print("\nStopped by user.")
        print(f"Latest result saved to: {output_path}")


# ============================================================
# Command-line arguments
# ============================================================

def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Standalone OpenBabyMonitor cry / babbling / laughing detector."
    )

    parser.add_argument(
        "--list-devices",
        action="store_true",
        help="List available microphone devices and exit.",
    )

    parser.add_argument(
        "--device",
        default=None,
        help="ALSA microphone device, example: plughw:1,0",
    )

    parser.add_argument(
        "--model",
        choices=["small", "large"],
        default="small",
        help="Choose crynet_small.onnx or crynet_large.onnx. Default: small.",
    )

    parser.add_argument(
        "--interval",
        type=float,
        default=5.0,
        help="Seconds between each audio recording/inference. Default: 5.",
    )

    parser.add_argument(
        "--amplification",
        type=float,
        default=10.0,
        help="Audio amplification used before inference. Default: 10.",
    )

    parser.add_argument(
        "--min-sound-contrast",
        type=float,
        default=0.0,
        help=(
            "Minimum contrast above background before classification. "
            "Use 0 for testing. Later try 10 or 15."
        ),
    )

    parser.add_argument(
        "--background-offset",
        type=float,
        default=0.0,
        help="Background loudness offset. Default: 0.",
    )

    parser.add_argument(
        "--probability-threshold",
        type=float,
        default=0.80,
        help="Minimum probability needed for crying/babbling decision. Default: 0.80.",
    )

    parser.add_argument(
        "--history-size",
        type=int,
        default=1,
        help=(
            "Number of recent results used for smoothing. "
            "Use 1 for testing; use 5 later for stable app output."
        ),
    )

    parser.add_argument(
        "--fraction-threshold",
        type=float,
        default=0.50,
        help="Fraction of history needed for smoothed decision. Default: 0.50.",
    )

    parser.add_argument(
        "--output-json",
        default=str(PROJECT_DIR / "latest_cry_result.json"),
        help="Where to save the latest result JSON.",
    )

    parser.add_argument(
        "--once",
        action="store_true",
        help="Run one detection cycle and exit.",
    )

    return parser


def main() -> None:
    parser = build_arg_parser()
    args = parser.parse_args()

    if args.list_devices:
        print_arecord_devices()
        return

    try:
        run_detector(args)
    except Exception as exc:
        raise SystemExit(f"\nERROR: {exc}\n")


if __name__ == "__main__":
    main()