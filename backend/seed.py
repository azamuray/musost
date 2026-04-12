import json
import os

from sqlalchemy.orm import Session
from models import Person


def seed_from_json(db: Session):
    count = db.query(Person).count()
    if count > 0:
        return

    seed_path = os.path.join(os.path.dirname(__file__), "seed_data.json")
    if not os.path.exists(seed_path):
        print("seed_data.json not found, skipping seed")
        return

    with open(seed_path, "r") as f:
        data = json.load(f)

    for row in data:
        person = Person(
            id=row["id"],
            name=row["name"],
            parent_id=row["parent_id"],
        )
        db.add(person)

    db.commit()
    print(f"Seeded {len(data)} persons")
