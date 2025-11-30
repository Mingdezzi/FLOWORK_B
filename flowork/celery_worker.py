from flowork import create_app
# [수정] celery_app 임포트
from flowork.extensions import celery_app

app = create_app()
# [중요] 외부에서는 'celery'라는 이름으로 참조함
celery = celery_app