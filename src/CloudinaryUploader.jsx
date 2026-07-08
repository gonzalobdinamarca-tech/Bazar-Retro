import { useState } from 'react';

/**
 * CloudinaryUploader Component
 * 
 * Permite subir múltiples imágenes a Cloudinary con optimización automática
 * NUEVO: Drag & drop para reordenar imágenes
 * 
 * Props:
 * - onImagesUploaded: función callback que recibe array de URLs
 * - currentImages: array de URLs existentes (opcional)
 * - maxImages: número máximo de imágenes (default: 5)
 */

export default function CloudinaryUploader({ 
  onImagesUploaded, 
  currentImages = [], 
  maxImages = 5,
  cloudName = 'dclf0c3ks',  // Tu Cloud Name
  uploadPreset = 'bazar-retro-products'
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);

  const uploadToCloudinary = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', uploadPreset);
    formData.append('folder', 'bazar-retro');

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      {
        method: 'POST',
        body: formData
      }
    );

    if (!response.ok) {
      throw new Error('Error al subir imagen');
    }

    const data = await response.json();
    return data.secure_url;
  };

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files);
    
    if (currentImages.length + files.length > maxImages) {
      setError(`Máximo ${maxImages} imágenes permitidas`);
      return;
    }

    setUploading(true);
    setError(null);
    setUploadProgress(0);

    try {
      const uploadPromises = files.map((file, index) => 
        uploadToCloudinary(file).then(url => {
          setUploadProgress(((index + 1) / files.length) * 100);
          return url;
        })
      );

      const uploadedUrls = await Promise.all(uploadPromises);
      const allImages = [...currentImages, ...uploadedUrls];
      
      onImagesUploaded(allImages);
      setUploadProgress(100);
      
      // Reset input
      e.target.value = '';
    } catch (err) {
      setError('Error al subir imágenes. Intenta de nuevo.');
      console.error('Upload error:', err);
    } finally {
      setTimeout(() => {
        setUploading(false);
        setUploadProgress(0);
      }, 1000);
    }
  };

  const handleRemoveImage = (indexToRemove) => {
    const newImages = currentImages.filter((_, index) => index !== indexToRemove);
    onImagesUploaded(newImages);
  };

  const handleReorder = (draggedIndex, droppedIndex) => {
    if (draggedIndex === droppedIndex) return;
    
    const newImages = [...currentImages];
    const [removed] = newImages.splice(draggedIndex, 1);
    newImages.splice(droppedIndex, 0, removed);
    onImagesUploaded(newImages);
  };

  return (
    <div style={{ width: '100%' }}>
      {/* Input de archivo */}
      <div style={{ marginBottom: '16px' }}>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          disabled={uploading || currentImages.length >= maxImages}
          style={{ display: 'none' }}
          id="cloudinary-upload"
        />
        <label
          htmlFor="cloudinary-upload"
          style={{
            display: 'inline-block',
            padding: '12px 24px',
            background: uploading || currentImages.length >= maxImages 
              ? '#9ca3af' 
              : 'linear-gradient(135deg, #7a9999, #5b7a7a)',
            color: 'white',
            borderRadius: '8px',
            cursor: uploading || currentImages.length >= maxImages ? 'not-allowed' : 'pointer',
            fontWeight: '600',
            fontSize: '14px',
            transition: 'all 0.3s',
            boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
            border: 'none'
          }}
        >
          {uploading ? '⏳ Subiendo...' : '📤 Subir Imágenes'}
        </label>
        <span style={{ 
          marginLeft: '12px', 
          fontSize: '13px', 
          color: '#6b7280',
          fontStyle: 'italic'
        }}>
          {currentImages.length}/{maxImages} imágenes
        </span>
      </div>

      {/* Barra de progreso */}
      {uploading && (
        <div style={{
          width: '100%',
          height: '8px',
          background: '#e5e7eb',
          borderRadius: '999px',
          overflow: 'hidden',
          marginBottom: '16px'
        }}>
          <div style={{
            width: `${uploadProgress}%`,
            height: '100%',
            background: 'linear-gradient(90deg, #10b981, #059669)',
            transition: 'width 0.3s ease',
            borderRadius: '999px'
          }} />
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          padding: '12px 16px',
          background: '#fee2e2',
          border: '2px solid #ef4444',
          borderRadius: '8px',
          color: '#991b1b',
          fontSize: '14px',
          marginBottom: '16px',
          fontWeight: '600'
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Preview de imágenes - CON DRAG & DROP */}
      {currentImages.length > 0 && (
        <div>
          <p style={{
            fontSize: '13px',
            color: '#059669',
            marginBottom: '8px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <span>✋</span>
            <span>Arrastra las imágenes para cambiar el orden</span>
          </p>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
            gap: '12px'
          }}>
            {currentImages.map((url, index) => (
              <div
                key={url + index}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', index.toString());
                  e.currentTarget.style.opacity = '0.4';
                }}
                onDragEnd={(e) => {
                  e.currentTarget.style.opacity = '1';
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  e.currentTarget.style.border = '3px dashed #10b981';
                  e.currentTarget.style.transform = 'scale(1.05)';
                }}
                onDragLeave={(e) => {
                  e.currentTarget.style.border = '2px solid #e5e7eb';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.style.border = '2px solid #e5e7eb';
                  e.currentTarget.style.transform = 'scale(1)';
                  
                  const draggedIndex = parseInt(e.dataTransfer.getData('text/plain'));
                  const droppedIndex = index;
                  
                  handleReorder(draggedIndex, droppedIndex);
                }}
                style={{
                  position: 'relative',
                  aspectRatio: '1',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  border: '2px solid #e5e7eb',
                  background: '#f9fafb',
                  cursor: 'grab',
                  transition: 'all 0.2s',
                  userSelect: 'none'
                }}
                onMouseDown={(e) => e.currentTarget.style.cursor = 'grabbing'}
                onMouseUp={(e) => e.currentTarget.style.cursor = 'grab'}
              >
                <img
                  src={url}
                  alt={`Preview ${index + 1}`}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    pointerEvents: 'none'
                  }}
                />
                
                {/* Botón eliminar */}
                <button
                  onClick={() => handleRemoveImage(index)}
                  style={{
                    position: 'absolute',
                    top: '4px',
                    right: '4px',
                    background: 'rgba(239, 68, 68, 0.9)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '50%',
                    width: '28px',
                    height: '28px',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                    zIndex: 10
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = '#dc2626';
                    e.currentTarget.style.transform = 'scale(1.1)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = 'rgba(239, 68, 68, 0.9)';
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  ×
                </button>
                
                {/* Badge "Principal" */}
                {index === 0 && (
                  <div style={{
                    position: 'absolute',
                    bottom: '4px',
                    left: '4px',
                    background: 'rgba(16, 185, 129, 0.9)',
                    color: 'white',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: '700'
                  }}>
                    ⭐ Principal
                  </div>
                )}
                
                {/* Número de orden */}
                <div style={{
                  position: 'absolute',
                  top: '4px',
                  left: '4px',
                  background: 'rgba(0, 0, 0, 0.7)',
                  color: 'white',
                  borderRadius: '50%',
                  width: '24px',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: '700'
                }}>
                  {index + 1}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info */}
      <div style={{
        marginTop: '16px',
        padding: '12px',
        background: 'rgba(59, 130, 246, 0.1)',
        border: '1px solid rgba(59, 130, 246, 0.3)',
        borderRadius: '8px',
        fontSize: '12px',
        color: '#1e40af'
      }}>
        💡 <strong>Tip:</strong> Las imágenes se optimizan automáticamente. 
        La primera imagen será la principal del producto.
      </div>
    </div>
  );
}