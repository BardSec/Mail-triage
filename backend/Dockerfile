FROM python:3.12-slim

WORKDIR /app

# Install dependencies in a separate layer for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .

EXPOSE 8000

# Run with a single worker by default.
# Scale horizontally (multiple replicas) rather than vertically here
# because SSE clients are tracked in-process memory.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
