FROM python:3.11-slim AS builder

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

FROM python:3.11-slim

WORKDIR /app

COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# [수정] tzdata 설치 추가 (한국 시간 설정을 위해 필수)
RUN apt-get update && \
    apt-get install -y curl tzdata && \
    mkdir -p /app/models && \
    curl -L -o /app/models/u2net.onnx https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2net.onnx && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

COPY . .

# [수정] Flask 앱이 모듈을 찾을 수 있도록 PYTHONPATH 설정
ENV PYTHONPATH=/app
ENV CUDA_VISIBLE_DEVICES=-1
ENV PYTHONUNBUFFERED=1
ENV TZ=Asia/Seoul

CMD ["gunicorn", "-c", "gunicorn.conf.py", "run:app"]