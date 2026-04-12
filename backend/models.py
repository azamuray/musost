from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship

from database import Base


class Person(Base):
    __tablename__ = "person"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    parent_id = Column(Integer, ForeignKey("person.id"), nullable=True)

    parent = relationship("Person", remote_side=[id], back_populates="children")
    children = relationship("Person", back_populates="parent")
