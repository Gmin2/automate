FROM python:3.13-slim

RUN apt-get update && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 libxrender1 libxext6 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY pyproject.toml .
RUN pip install --no-cache-dir "cadquery-ocp-novtk>=8.0" "numpy>=2"

COPY automate automate
COPY web/dist web/dist
COPY fixtures/*.step fixtures/
COPY examples.json WM290V_RedrawStart.stp ./

EXPOSE 8000
CMD ["sh", "-c", "python -m automate serve WM290V_RedrawStart.stp fixtures/*.step --host 0.0.0.0 --port ${PORT:-8000} --preload"]
