---
title: "Image Classifier"
summary: "A comparison of neural networks for classifying conditions in chest X-rays."
category: "Earlier work"
tools: ["Python", "PyTorch", "Torchvision", "scikit-learn"]
order: 25
featured: false
status: "Group project"
visual: "code"
repo: "https://github.com/f-petrozzi/Image_Classification_DL"
---

Our group compared a CNN built from scratch with a fine-tuned ResNet-50 in PyTorch, using a subset of the NIH chest X-ray dataset. Each image could have more than one condition label.

We tracked training and validation results, then evaluated predictions with ROC and precision-recall curves. We also compared results for individual conditions alongside the overall scores.
