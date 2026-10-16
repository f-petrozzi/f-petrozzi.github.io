---
title: "Optuna"
summary: "Tuning a customer churn prediction model with Optuna."
category: "Earlier work"
tools: ["Python", "PyTorch", "Optuna", "scikit-learn"]
order: 21
featured: false
status: "Class presentation"
visual: "code"
repo: "https://github.com/f-petrozzi/Optuna_CNN"
---

For this class presentation, I used Optuna to tune a neural network in PyTorch on the Telco Customer Churn dataset.

Each trial tests a combination of layer sizes, dropout, learning rate, and optimizer. Validation loss determines which configuration performs best, and pruning stops less promising trials early.

The notebook includes plots of the trial history and parameter importance, along with a recorded walkthrough of the code.
