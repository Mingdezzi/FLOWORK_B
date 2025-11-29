# [중요] 반드시 extensions의 db를 가져와야 합니다. 새로 생성하면 안 됩니다.
from flowork.extensions import db

# 모델들을 임포트하여 db.Model에 등록되도록 함
from .auth import User
from .store import Brand, Store, Setting
from .product import Product, Variant, StoreStock, StockHistory
from .sales import Sale, SaleItem
from .store_order import StoreOrder
from .stock_transfer import StockTransfer