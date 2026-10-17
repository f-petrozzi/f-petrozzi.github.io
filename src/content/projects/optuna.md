---
title: "Optuna"
summary: "Tuning a customer churn model with Optuna."
category: "Earlier work"
tools: ["Python", "PyTorch", "Optuna", "scikit-learn"]
order: 21
featured: false
status: "Class presentation"
visual: "code"
repo: "https://github.com/f-petrozzi/Optuna_CNN"
---

For this class presentation, I used Optuna to tune a PyTorch neural network on Telco Customer Churn data.

Trials vary layer sizes, dropout, learning rate and optimizer. Validation loss ranks configurations. Pruning stops weaker trials early.

The notebook includes trial history, parameter importance plots and a recorded code walkthrough.
