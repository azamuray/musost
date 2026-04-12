from typing import List, Optional

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from database import Base, engine, get_db
from models import Person
from schemas import PersonCreate, PersonRead, PersonUpdate, PersonTreeNode
from seed import seed_from_json

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
    finally:
        db.close()


def build_tree(persons: List[Person], parent_id: Optional[int] = None) -> List[PersonTreeNode]:
    nodes = []
    for p in persons:
        if p.parent_id == parent_id:
            children = build_tree(persons, p.id)
            nodes.append(PersonTreeNode(id=p.id, name=p.name, children=children))
    return nodes


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
def create_person(data: PersonCreate, db: Session = Depends(get_db)):
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
def update_person(person_id: int, data: PersonUpdate, db: Session = Depends(get_db)):
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
def delete_person(person_id: int, db: Session = Depends(get_db)):
    person = db.query(Person).filter(Person.id == person_id).first()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")
    db.delete(person)
    db.commit()
