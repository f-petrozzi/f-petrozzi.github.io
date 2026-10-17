---
title: "Image Classifier"
summary: "Comparing neural networks for chest X-ray classification."
category: "Earlier work"
tools: ["Python", "PyTorch", "Torchvision", "scikit-learn"]
order: 25
featured: false
status: "Group project"
visual: "code"
repo: "https://github.com/f-petrozzi/Image_Classification_DL"
---

Our group compared a CNN built from scratch with a fine-tuned ResNet-50 in PyTorch. We used a subset of NIH chest X-rays with multiple condition labels per image.

We tracked training and validation, then compared overall and per-condition results with ROC and precision-recall curves.
