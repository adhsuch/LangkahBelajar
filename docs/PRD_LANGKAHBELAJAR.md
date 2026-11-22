# Product Requirements

**Source of truth:** `Makalah_DDD_LangkahBelajar_18224030_18224120.pdf`, stored one folder above this repository. If this document and the paper disagree, the paper wins.

## Goal

Give elementary school children with ADHD, dyslexia, and autism a calm way to practice foundational skills, and give their caregivers a clear view of per-skill progress. The first audience is children studying outside large cities, so the app is light and keeps working with stored materials when connectivity is limited.

## Users

- **Child:** performs learning activities on a device with a caregiver nearby.
- **Caregiver (parent or teacher):** owns the account, creates the profile, chooses targets and supports, and reviews results.

## Principles

1. Needs are met through individual, combinable settings, never one pattern per diagnosis.
2. No diagnosis is uploaded or stored, and no ability profile is derived from a condition.
3. Content stays at a foundational level. A grade 1 to 6 curriculum is out of scope.
4. Accessibility follows CAST Universal Design for Learning: engagement, representation, and action and expression.
5. The app never claims clinical effectiveness and never infers decline from pauses.

## Functional requirements

| Screen | Requirement | Status |
|---|---|---|
| Login and registration | Caregiver sign-up, sign-in, sign-out, protected routes | Done |
| Child profile | Nickname, targets, support preferences, optional notes, no diagnosis | Done |
| Starter activities | One light activity per skill, no score, no effect on mastery | Done |
| Routine home | Schedule and the start, practice, break, finish pattern | Done |
| Learning session | Preview, worked example, repeat, support, pause, continue, resume | Done |
| Practice modules | Reading, writing, counting, instructions, engagement, routine | Done |
| Caregiver progress | Per-skill history, read-only summaries, notes, stage review | Done |
| Profile and settings | Edit profile and account, share with another caregiver | Done |
| Stored materials | Valid stored materials and provider connection status | Done |

## Mastery rule

A result is an **independent success** when it is correct on the first attempt without a hint or worked example. Access supports such as audio, text size, and visual cues never reduce independence.

After independent success in **two different sessions** at the current stage, the app offers the next stage. The caregiver decides whether to advance or keep practicing. This is a planning threshold from the paper, not a validated developmental standard.

## Out of scope

Automated diagnosis, handwriting scoring, AI in the core app, payments, ads, social features, complex recommendation algorithms, and real child data.
