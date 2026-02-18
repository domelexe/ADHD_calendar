from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.base import get_db
from app.models.contact import Contact
from app.models.user import User
from app.schemas.contact import ContactCreate, ContactUpdate, ContactOut

router = APIRouter(prefix="/contacts", tags=["contacts"])


@router.get("", response_model=List[ContactOut])
def list_contacts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(Contact)
        .filter(Contact.user_id == current_user.id)
        .order_by(Contact.name)
        .all()
    )


@router.post("", response_model=ContactOut, status_code=201)
def create_contact(
    body: ContactCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    contact = Contact(**body.model_dump(), user_id=current_user.id)
    db.add(contact)
    db.commit()
    db.refresh(contact)
    return contact


@router.get("/{contact_id}", response_model=ContactOut)
def get_contact(
    contact_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    contact = (
        db.query(Contact)
        .filter(Contact.id == contact_id, Contact.user_id == current_user.id)
        .first()
    )
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    return contact


@router.put("/{contact_id}", response_model=ContactOut)
def update_contact(
    contact_id: int,
    body: ContactUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    contact = (
        db.query(Contact)
        .filter(Contact.id == contact_id, Contact.user_id == current_user.id)
        .first()
    )
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(contact, k, v)
    db.commit()
    db.refresh(contact)
    return contact


@router.delete("/{contact_id}", status_code=204)
def delete_contact(
    contact_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    contact = (
        db.query(Contact)
        .filter(Contact.id == contact_id, Contact.user_id == current_user.id)
        .first()
    )
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    db.delete(contact)
    db.commit()
