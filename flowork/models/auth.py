from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from . import db

class User(UserMixin, db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    # [수정] unique=True 제거 (브랜드 간 아이디 중복 허용)
    username = db.Column(db.String(50), nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False, default='staff')
    
    # 소속 정보
    brand_id = db.Column(db.Integer, db.ForeignKey('brands.id'), nullable=True)
    store_id = db.Column(db.Integer, db.ForeignKey('stores.id'), nullable=True)
    
    # 상태 정보
    created_at = db.Column(db.DateTime, server_default=db.func.now())
    is_active = db.Column(db.Boolean, default=False) 

    # 관계 설정
    brand = db.relationship('Brand', backref='users')
    store = db.relationship('Store', backref='users')

    # [신규] 브랜드 내에서만 아이디 중복 방지 (슈퍼관리자는 brand_id가 NULL이므로 예외)
    __table_args__ = (
        db.UniqueConstraint('brand_id', 'username', name='_brand_username_uc'),
    )

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    @property
    def is_super_admin(self):
        return self.role == 'super_admin'

    @property
    def is_admin(self):
        return self.role == 'admin' or self.role == 'super_admin'

    @property
    def current_brand_id(self):
        if self.brand_id:
            return self.brand_id
        if self.store and self.store.brand_id:
            return self.store.brand_id
        return None

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'role': self.role,
            'brand_id': self.brand_id,
            'store_id': self.store_id,
            'is_active': self.is_active
        }