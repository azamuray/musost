import os
from typing import List, Optional

from fastapi import FastAPI, Depends, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from database import Base, engine, get_db
from models import Person
from schemas import PersonCreate, PersonRead, PersonUpdate, PersonTreeNode
from seed import seed_from_json

ADMIN_CODE = os.getenv("ADMIN_CODE", "101")


def verify_code(x_admin_code: str = Header(...)):
    if x_admin_code != ADMIN_CODE:
        raise HTTPException(status_code=403, detail="Неверный код")


app = FastAPI(title="Musost API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)
    db = next(get_db())
    try:
        seed_from_json(db)
        # Sync sequence with actual max id to prevent duplicate key errors
        db.execute(text("SELECT setval('person_id_seq', COALESCE((SELECT MAX(id) FROM person), 1))"))
        db.commit()
    finally:
        db.close()


def build_tree(persons: List[Person], parent_id: Optional[int] = None) -> List[PersonTreeNode]:
    nodes = []
    for p in persons:
        if p.parent_id == parent_id:
            children = build_tree(persons, p.id)
            nodes.append(PersonTreeNode(id=p.id, name=p.name, children=children))
    return nodes


@app.post("/api/verify-code")
def check_code(_=Depends(verify_code)):
    return {"ok": True}


@app.get("/api/persons", response_model=List[PersonRead])
def get_persons(db: Session = Depends(get_db)):
    return db.query(Person).order_by(Person.id).all()


@app.get("/api/tree", response_model=List[PersonTreeNode])
def get_tree(db: Session = Depends(get_db)):
    persons = db.query(Person).all()
    return build_tree(persons, parent_id=None)


@app.get("/api/persons/{person_id}", response_model=PersonRead)
def get_person(person_id: int, db: Session = Depends(get_db)):
    person = db.query(Person).filter(Person.id == person_id).first()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")
    return person


@app.post("/api/persons", response_model=PersonRead, status_code=201)
def create_person(data: PersonCreate, db: Session = Depends(get_db), _=Depends(verify_code)):
    if data.parent_id:
        parent = db.query(Person).filter(Person.id == data.parent_id).first()
        if not parent:
            raise HTTPException(status_code=404, detail="Parent not found")
    person = Person(name=data.name, parent_id=data.parent_id)
    db.add(person)
    db.commit()
    db.refresh(person)
    return person


@app.put("/api/persons/{person_id}", response_model=PersonRead)
def update_person(person_id: int, data: PersonUpdate, db: Session = Depends(get_db), _=Depends(verify_code)):
    person = db.query(Person).filter(Person.id == person_id).first()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")
    if data.name is not None:
        person.name = data.name
    if data.parent_id is not None:
        person.parent_id = data.parent_id
    db.commit()
    db.refresh(person)
    return person


@app.delete("/api/persons/{person_id}", status_code=204)
def delete_person(person_id: int, db: Session = Depends(get_db), _=Depends(verify_code)):
    person = db.query(Person).filter(Person.id == person_id).first()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")

    def delete_recursive(p_id: int):
        children = db.query(Person).filter(Person.parent_id == p_id).all()
        for child in children:
            delete_recursive(child.id)
        db.query(Person).filter(Person.id == p_id).delete()

    delete_recursive(person_id)
    db.commit()
    # Reset sequence to max id so next insert gets correct id
    db.execute(text("SELECT setval('person_id_seq', COALESCE((SELECT MAX(id) FROM person), 1))"))
    db.commit()
