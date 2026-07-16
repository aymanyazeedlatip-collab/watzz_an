"""Canonical Sultan Kudarat municipality names used by the model artifacts."""
from __future__ import annotations

MUNICIPALITIES = [
    "Bagumbayan",
    "Columbio",
    "Esperanza",
    "Isulan",
    "Kalamansig",
    "Lambayong",
    "Lebak",
    "Lutayan",
    "Palimbang",
    "President Quirino",
    "Senator Ninoy Aquino",
    "Tacurong City",
]

_ALIASES = {
    "tacurong": "Tacurong City",
    "city of tacurong": "Tacurong City",
    "tacurong city": "Tacurong City",
    "sen ninoy aquino": "Senator Ninoy Aquino",
    "sen. ninoy aquino": "Senator Ninoy Aquino",
    "senator ninoy aquino": "Senator Ninoy Aquino",
    "pres quirino": "President Quirino",
    "pres. quirino": "President Quirino",
    "president quirino": "President Quirino",
}


def normalize_municipality(value: str) -> str:
    """Return the exact municipality label expected by the trained pipeline."""
    cleaned = " ".join(value.strip().replace("_", " ").split())
    lowered = cleaned.lower()
    if lowered in _ALIASES:
        return _ALIASES[lowered]
    for municipality in MUNICIPALITIES:
        if municipality.lower() == lowered:
            return municipality
    raise ValueError(
        f"Unsupported municipality '{value}'. Choose one of: {', '.join(MUNICIPALITIES)}."
    )
