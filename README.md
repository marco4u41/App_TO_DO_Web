# ToDo App

Aplicación web moderna de lista de tareas (To Do List) construida con Python y Flask.

## Tecnologías

- **Backend:** Python 3.12+, Flask, SQLAlchemy, SQLite
- **Frontend:** HTML5, CSS3, JavaScript (Vanilla), Bootstrap 5, Bootstrap Icons
- **Diseño:** Interfaz minimalista, modo oscuro, responsive, animaciones CSS

## Características

- Crear, editar, eliminar y completar tareas
- Deshacer tareas completadas
- Filtros por estado, prioridad y categoría
- Búsqueda en tiempo real por título y descripción
- Ordenamiento por fecha, prioridad, fecha límite y alfabético
- Dashboard con estadísticas y barra de progreso
- Categorías predefinidas (Trabajo, Universidad, Personal, Compras, Salud, Otras)
- Prioridades (Alta, Media, Baja) con indicadores de color
- Detección de tareas vencidas y por vencer hoy
- Validación de formularios
- Toast notifications
- Modo oscuro / claro con persistencia
- Diseño responsive (PC, tablet, móvil)
- Atajos de teclado
- Modal para crear y editar tareas
- Confirmación antes de eliminar
- Persistencia en SQLite

## Requisitos

- Python 3.12 o superior
- pip (administrador de paquetes de Python)

## Instalación

1. Clonar o descargar el proyecto:

```bash
cd todo_app
```

2. Crear un entorno virtual:

```bash
python -m venv venv
```

3. Activar el entorno virtual:

Windows:
```bash
venv\Scripts\activate
```

Linux / Mac:
```bash
source venv/bin/activate
```

4. Instalar las dependencias:

```bash
pip install -r requirements.txt
```

## Ejecución

```bash
python app.py
```

O con Flask:

```bash
flask run
```

La aplicación estará disponible en: `http://localhost:5000`

## Estructura del proyecto

```
todo_app/
│
├── app.py                    # Punto de entrada
├── config.py                 # Configuración
├── requirements.txt          # Dependencias
├── README.md                 # Documentación
│
├── database/
│     └── database.db         # Base de datos SQLite (auto-creada)
│
├── models/
│     └── task.py             # Modelo Task (SQLAlchemy)
│
├── routes/
│     └── routes.py           # Rutas y endpoints API
│
├── static/
│     ├── css/
│     │     └── style.css     # Estilos
│     ├── js/
│     │     └── app.js        # Lógica frontend
│     └── images/
│
├── templates/
│     ├── base.html           # Plantilla base
│     └── index.html          # Página principal
│
└── utils/
      └── validators.py       # Validaciones
```

## Atajos de teclado

| Tecla      | Acción          |
|------------|-----------------|
| `Ctrl + K` | Buscar tareas   |
| `N`        | Nueva tarea     |
| `Esc`      | Cerrar notificación |

## API Endpoints

| Método   | Ruta                       | Descripción                |
|----------|----------------------------|----------------------------|
| GET      | `/`                        | Página principal           |
| GET      | `/api/tasks`               | Listar tareas              |
| POST     | `/api/tasks`               | Crear tarea                |
| GET      | `/api/tasks/<id>`          | Obtener tarea              |
| PUT      | `/api/tasks/<id>`          | Actualizar tarea           |
| PATCH    | `/api/tasks/<id>/toggle`   | Cambiar estado             |
| DELETE   | `/api/tasks/<id>`          | Eliminar tarea             |
| GET      | `/api/stats`               | Estadísticas               |
| GET      | `/api/search?q=`           | Buscar tareas              |
| GET      | `/api/filter?status=&...`  | Filtrar tareas             |

## Personalización

Para cambiar la paleta de colores, modificar las variables CSS en `static/css/style.css`:

```css
:root {
    --color-primary: #4F46E5;
    --color-secondary: #818CF8;
    --color-success: #22C55E;
    --color-danger: #EF4444;
    --color-warning: #F59E0B;
    --bg-body: #F5F7FB;
    --bg-card: #FFFFFF;
    --color-text: #1F2937;
}
```

## Licencia

MIT
