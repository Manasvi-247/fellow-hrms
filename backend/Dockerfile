FROM python:3.12-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1
WORKDIR /app

FROM base AS deps
COPY requirements.txt .
RUN pip install --prefix=/install -r requirements.txt

FROM base AS runtime
RUN useradd --create-home --uid 10001 appuser
COPY --from=deps /install /usr/local
COPY alembic.ini ./
COPY alembic ./alembic
COPY app ./app
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
USER 10001
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health')"
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
