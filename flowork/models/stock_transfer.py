from . import db

class StockTransfer(db.Model):
    __tablename__ = 'stock_transfers'

    id = db.Column(db.Integer, primary_key=True)
    source_store_id = db.Column(db.Integer, db.ForeignKey('stores.id'), nullable=False)
    target_store_id = db.Column(db.Integer, db.ForeignKey('stores.id'), nullable=False)
    variant_id = db.Column(db.Integer, db.ForeignKey('variants.id'), nullable=False)
    
    quantity = db.Column(db.Integer, nullable=False)
    
    # REQUESTED(요청됨), APPROVED(승인/출고중), SHIPPED(출고완료), RECEIVED(입고완료), REJECTED(거절)
    status = db.Column(db.String(20), default='REQUESTED')
    
    # REQUEST(매장간요청), INSTRUCTION(본사지시)
    transfer_type = db.Column(db.String(20), default='REQUEST')
    
    created_at = db.Column(db.DateTime, server_default=db.func.now())
    updated_at = db.Column(db.DateTime, onupdate=db.func.now())
    
    source_store = db.relationship('Store', foreign_keys=[source_store_id], backref='transfers_out')
    target_store = db.relationship('Store', foreign_keys=[target_store_id], backref='transfers_in')
    variant = db.relationship('Variant')