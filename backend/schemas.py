from typing import Optional, List
from pydantic import BaseModel


class PersonBase(BaseModel):
    name: str
    parent_id: Optional[int] = None


class PersonCreate(PersonBase):
    pass


class PersonUpdate(PersonBase):
    name: Optional[str] = None


class PersonRead(PersonBase):
    id: int

    class Config:
        from_attributes = True


class PersonTreeNode(BaseModel):
    id: int
    name: str
    children: List["PersonTreeNode"] = []

    class Config:
        from_attributes = True
