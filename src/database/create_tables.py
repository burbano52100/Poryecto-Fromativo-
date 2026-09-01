from database import Base, engine
from models import Aprendiz  # noqa: F401  (registra el modelo en Base.metadata)

if __name__ == "__main__":
    Base.metadata.create_all(bind=engine)
    print("Tablas creadas en la base de datos proyecto_formativo.")
