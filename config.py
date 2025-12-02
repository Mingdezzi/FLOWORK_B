import os
import time
from dotenv import load_dotenv

load_dotenv()

class Config:
    # Timezone 설정
    os.environ['TZ'] = os.getenv('TZ', 'Asia/Seoul')
    try:
        time.tzset()
    except AttributeError:
        pass # Windows 등에서는 무시

    SECRET_KEY = os.getenv('SECRET_KEY', 'dev_key_please_change')
    
    BASE_DIR = os.path.abspath(os.path.dirname(__file__))
    
    # [수정] DATABASE_URL이 없으면 개별 환경변수 조합으로 생성 (호환성 확보)
    SQLALCHEMY_DATABASE_URI = os.getenv('DATABASE_URL')
    if not SQLALCHEMY_DATABASE_URI:
        user = os.getenv('POSTGRES_USER', 'postgres')
        pw = os.getenv('POSTGRES_PASSWORD', 'password')
        host = os.getenv('POSTGRES_HOST', 'db') # docker service name
        port = os.getenv('POSTGRES_PORT', '5432')
        db_name = os.getenv('POSTGRES_DB', 'flowork')
        SQLALCHEMY_DATABASE_URI = f"postgresql://{user}:{pw}@{host}:{port}/{db_name}"

    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # 업로드 폴더 설정 (Docker volume 경로와 일치)
    UPLOAD_FOLDER = os.path.join(BASE_DIR, 'flowork', 'static', 'product_images')
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024

    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_size': 20,
        'max_overflow': 40,
        'pool_timeout': 30,
        'pool_recycle': 1800,
        'pool_pre_ping': True,
    }

    CELERY_BROKER_URL = os.getenv('CELERY_BROKER_URL', 'redis://redis:6379/0')
    CELERY_RESULT_BACKEND = os.getenv('CELERY_RESULT_BACKEND', 'redis://redis:6379/0')
    CELERY_BROKER_CONNECTION_RETRY_ON_STARTUP = True
    CELERY_WORKER_MAX_TASKS_PER_CHILD = 50

    CACHE_TYPE = 'RedisCache'
    CACHE_REDIS_URL = CELERY_BROKER_URL
    CACHE_DEFAULT_TIMEOUT = 300