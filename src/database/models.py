from sqlalchemy import Boolean, Column, Integer, String

from .database import Base


class Aprendiz(Base):
    __tablename__ = "aprendices"

    id = Column(Integer, primary_key=True, autoincrement=True)
    id_ficha = Column(Integer, nullable=False)
    nombre = Column(String(100), nullable=False)
    apellido = Column(String(100), nullable=False)
    lider_ficha = Column(Boolean, nullable=False, default=False)
    correo_electronico = Column(String(150), nullable=False, unique=True)
