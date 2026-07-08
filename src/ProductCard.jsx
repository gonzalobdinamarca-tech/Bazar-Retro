export default function ProductCard({ product }) {
  return (
    <div style={{
      border: '2px solid #e5e7eb',
      borderRadius: '16px',
      padding: '16px',
      background: 'white',
      boxShadow: '0 4px 6px rgba(0,0,0,0.07)'
    }}>
      <style>{`
        .product-card-image-container {
          width: 100%;
          height: 160px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f3f4f6;
          border-radius: 8px;
          margin-bottom: 12px;
          overflow: hidden;
        }

        .product-card-title {
          font-size: 16px;
          font-weight: 600;
          color: #1f2937;
          margin-bottom: 8px;
          line-height: 1.4;
        }

        .product-card-text {
          font-size: 14px;
          color: #4b5563;
          margin-bottom: 4px;
        }

        .product-card-category {
          font-size: 12px;
          color: #6b7280;
          margin-top: 8px;
        }

        /* MOBILE - 480px and down */
        @media (max-width: 480px) {
          .product-card-image-container {
            height: 180px;
          }

          .product-card-title {
            font-size: 15px;
          }
        }
      `}</style>

      {product.images && product.images.length > 0 ? (
        <div className="product-card-image-container">
          <img
            src={product.images[0]}
            alt={product.name}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover'
            }}
          />
        </div>
      ) : (
        <div className="product-card-image-container">
          <span style={{ color: '#9ca3af', fontSize: '14px', fontWeight: '500' }}>
            Sin imagen
          </span>
        </div>
      )}

      <h4 className="product-card-title">
        {product.name}
      </h4>

      <p className="product-card-text">
        <strong>Precio:</strong> ${product.price.toLocaleString('es-CL')}
      </p>

      <p className="product-card-text">
        <strong>Cantidad:</strong> {product.quantity}
      </p>

      <p className="product-card-category">
        <strong>Categoría:</strong> {product.category}
      </p>

      {product.videos && product.videos.length > 0 && (
        <div style={{ marginTop: '12px' }}>
          <iframe
            src={product.videos[0]}
            title="video"
            allowFullScreen
            style={{
              width: '100%',
              height: '160px',
              borderRadius: '8px',
              border: 'none'
            }}
          />
        </div>
      )}
    </div>
  );
}