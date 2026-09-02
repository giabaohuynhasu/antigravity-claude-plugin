---
name: alrp-queueing
description: Mathematical simulation, differential equations, and M/G/1 queueing theory analysis for Accelerated Longevity Regimes & Public Health (ALRP) and Cybersecurity timescale divergence.
---

# ALRP & Longevity Asymmetry Queueing Theory Skill

Enables Claude to analyze, solve, and simulate timescale asymmetries, Gompertz-Makeham mortality divergence, and $M/G/1$ cybernetic queueing instability models.

## Core Equations
- Arrival Rate: $\lambda(t) = \lambda_0 e^{\alpha t}$
- Service Remediation Capacity: $\mu \in [0.025, 0.052]\text{ patches/day}$
- Traffic Intensity: $\rho(t) = \frac{\lambda(t)}{\mu}$
- Critical Instability Horizon: $t^* = \frac{1}{\alpha} \ln\left(\frac{\mu}{\lambda_0}\right)$
- Pollaczek-Khinchine Workload: $W(t) = \frac{\lambda(t) \mathbb{E}[S^2]}{2(1 - \rho(t))}$

## Executable Simulator
Run 5,000 Monte Carlo paths via Antigravity Python virtualenv:
```powershell
& "C:\Users\nswcl\.gemini\antigravity-ide\scratch\.venv\Scripts\python.exe" "C:\Users\nswcl\.gemini\antigravity-ide\scratch\alrp_queueing_report_generator.py"
```
