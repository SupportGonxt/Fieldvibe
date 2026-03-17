/**
 * Polygon Drawer Component - Canvas-based polygon drawing for board coverage calculation
 * 
 * Features:
 * - Draw polygon on uploaded image
 * - Calculate polygon area using Shoelace formula
 * - Support for storefront and board polygons
 * - Touch-friendly for mobile devices
 */

import React, { useRef, useState, useEffect } from 'react';
import { Box, Button, Typography, Paper, Alert } from '@mui/material';
import { Undo, Check, Clear } from '@mui/icons-material';
import { useToast } from '../../components/ui/Toast'

interface Point {
  x: number;
  y: number;
}

interface PolygonDrawerProps {
  imageUrl: string;
  onComplete: (polygon: Point[], area: number) => void;
  label: string;
  color?: string;
}

export default function PolygonDrawer({
  imageUrl,
  onComplete,
  label,
  color = '#00ff00',
}: PolygonDrawerProps) {
  const { toast } = useToast()
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const img = new Image();
    img.onload = () => {
      const maxWidth = Math.min(window.innerWidth - 40, 800);
      const maxHeight = Math.min(window.innerHeight - 300, 600);
      
      let width = img.width;
      let height = img.height;
      
      if (width > maxWidth) {
        height = (maxWidth / width) * height;
        width = maxWidth;
      }
      
      if (height > maxHeight) {
        width = (maxHeight / height) * width;
        height = maxHeight;
      }
      
      canvas.width = width;
      canvas.height = height;
      setCanvasSize({ width, height });
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
      }
      
      setImageLoaded(true);
    };
    
    img.src = imageUrl;
  }, [imageUrl]);

  useEffect(() => {
    if (!imageLoaded) return;
    redrawCanvas();
  }, [points, imageLoaded]);

  const redrawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      if (points.length > 0) {
        ctx.strokeStyle = color;
        ctx.fillStyle = color + '40'; // 25% opacity
        ctx.lineWidth = 3;
        
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        
        for (let i = 1; i < points.length; i++) {
          ctx.lineTo(points[i].x, points[i].y);
        }
        
        if (points.length > 2) {
          ctx.closePath();
          ctx.fill();
        }
        
        ctx.stroke();
        
        points.forEach((point, index) => {
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(point.x, point.y, 6, 0, 2 * Math.PI);
          ctx.fill();
          
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 12px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText((index + 1).toString(), point.x, point.y);
        });
      }
    };
    img.src = imageUrl;
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setPoints([...points, { x, y }]);
  };

  const handleUndo = () => {
    if (points.length > 0) {
      setPoints(points.slice(0, -1));
    }
  };

  const handleClear = () => {
    setPoints([]);
    setIsDrawing(true);
  };

  const handleComplete = () => {
    if (points.length < 3) {
      toast.error('Please draw at least 3 points to form a polygon');
      return;
    }

    const area = calculatePolygonArea(points);
    onComplete(points, area);
    setIsDrawing(false);
  };

  const calculatePolygonArea = (polygon: Point[]): number => {
    let area = 0;
    const n = polygon.length;

    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += polygon[i].x * polygon[j].y;
      area -= polygon[j].x * polygon[i].y;
    }

    return Math.abs(area / 2);
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        {label}
      </Typography>
      
      {!isDrawing && points.length === 0 && (
        <Button
          variant="contained"
          onClick={() => setIsDrawing(true)}
          fullWidth
          sx={{ mb: 2 }}
        >
          Start Drawing
        </Button>
      )}

      {isDrawing && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Click on the image to add points. Connect at least 3 points to form a polygon.
        </Alert>
      )}

      <Paper elevation={3} sx={{ p: 1, mb: 2 }}>
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          style={{
            cursor: isDrawing ? 'crosshair' : 'default',
            maxWidth: '100%',
            display: 'block',
            margin: '0 auto',
          }}
        />
      </Paper>

      {isDrawing && points.length > 0 && (
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
          <Button
            variant="outlined"
            startIcon={<Undo />}
            onClick={handleUndo}
            disabled={points.length === 0}
          >
            Undo
          </Button>
          <Button
            variant="outlined"
            startIcon={<Clear />}
            onClick={handleClear}
            color="error"
          >
            Clear
          </Button>
          <Button
            variant="contained"
            startIcon={<Check />}
            onClick={handleComplete}
            disabled={points.length < 3}
            color="success"
          >
            Complete ({points.length} points)
          </Button>
        </Box>
      )}

      {!isDrawing && points.length > 0 && (
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="body1" color="success.main">
            ✓ Polygon completed with {points.length} points
          </Typography>
          <Button
            variant="outlined"
            onClick={() => setIsDrawing(true)}
            sx={{ mt: 1 }}
          >
            Redraw
          </Button>
        </Box>
      )}
    </Box>
  );
}
