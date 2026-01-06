"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type CropDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  src: string | null
  title?: string
  maskShape?: "square" | "circle"
  outputSize?: number
  onCancel?: () => void
  onCropped: (dataUrl: string) => void
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

export function ImageCropDialog({
  open,
  onOpenChange,
  src,
  title = "Crop photo",
  maskShape = "square",
  outputSize = 800,
  onCancel,
  onCropped,
}: CropDialogProps) {
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [containerSize, setContainerSize] = useState<{ w: number; h: number }>({ w: 360, h: 360 })
  const [crop, setCrop] = useState<{ x: number; y: number; size: number }>({ x: 40, y: 40, size: 240 })
  const dragRef = useRef<
    | { kind: "move"; startX: number; startY: number; origX: number; origY: number }
    | { kind: "resize"; startX: number; startY: number; origSize: number; origX: number; origY: number }
    | null
  >(null)

  const cropSize = 360 // visual crop area container (square)

  useEffect(() => {
    // Reset controls when opening a new image
    if (open && src) {
      setImgSize(null)
    }
  }, [open, src])

  useEffect(() => {
    if (!open) return
    const el = containerRef.current
    if (!el) return
    const update = () => {
      const rect = el.getBoundingClientRect()
      const s = Math.floor(Math.min(rect.width, rect.height))
      setContainerSize({ w: s, h: s })
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [open])

  useEffect(() => {
    // Initialize crop square when image loads / container resizes
    if (!imgSize) return
    const s = Math.floor(containerSize.w)
    const size = Math.floor(s * 0.7)
    const x = Math.floor((s - size) / 2)
    const y = Math.floor((s - size) / 2)
    setCrop({ x, y, size })
  }, [imgSize, containerSize.w])

  const rendered = useMemo(() => {
    if (!imgSize) return null
    // Fit image inside square container (contain)
    const s = containerSize.w
    const scale = Math.min(s / imgSize.w, s / imgSize.h)
    const w = imgSize.w * scale
    const h = imgSize.h * scale
    const x = (s - w) / 2
    const y = (s - h) / 2
    return { x, y, w, h, scale }
  }, [imgSize, containerSize.w])

  const handleApply = async () => {
    if (!src || !imgRef.current || !imgSize || !rendered) return

    const img = imgRef.current

    // Crop square in image pixel coords
    const cropInImageX = (crop.x - rendered.x) / rendered.scale
    const cropInImageY = (crop.y - rendered.y) / rendered.scale
    const cropInImageSize = crop.size / rendered.scale

    const canvas = document.createElement("canvas")
    canvas.width = outputSize
    canvas.height = outputSize
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Safety clamp source rect
    const safeSSize = clamp(cropInImageSize, 1, Math.min(imgSize.w, imgSize.h))
    const safeSx = clamp(cropInImageX, 0, Math.max(0, imgSize.w - safeSSize))
    const safeSy = clamp(cropInImageY, 0, Math.max(0, imgSize.h - safeSSize))

    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = "high"
    ctx.drawImage(img, safeSx, safeSy, safeSSize, safeSSize, 0, 0, outputSize, outputSize)

    const dataUrl = canvas.toDataURL("image/jpeg", 0.9)
    onCropped(dataUrl)
    onOpenChange(false)
  }

  const close = () => {
    onOpenChange(false)
    onCancel?.()
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "z-[10050]"
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-1/2 w-full max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background p-6 shadow-lg outline-none",
            "z-[10050]"
          )}
        >
          <div className="flex flex-col gap-2 text-center sm:text-left">
            <DialogPrimitive.Title className="text-lg font-semibold leading-none">{title}</DialogPrimitive.Title>
          </div>

          <div className="mt-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Your photo will be saved as a <span className="font-medium">square</span>. Drag the crop box and resize it (fixed 1:1).
            </p>

            <div
              ref={containerRef}
              className="relative mx-auto overflow-hidden rounded-xl border border-border bg-muted"
              style={{ width: cropSize, height: cropSize }}
            >
              {src ? (
                <img
                  ref={imgRef}
                  src={src}
                  alt="Crop"
                  draggable={false}
                  onLoad={(e) => {
                    const el = e.currentTarget
                    setImgSize({ w: el.naturalWidth, h: el.naturalHeight })
                  }}
                  className="absolute left-0 top-0 select-none"
                  style={{
                    left: rendered ? rendered.x : 0,
                    top: rendered ? rendered.y : 0,
                    width: rendered ? rendered.w : undefined,
                    height: rendered ? rendered.h : undefined,
                  }}
                />
              ) : null}

              {/* Crop square overlay */}
              <div
                className={cn(
                  "absolute outline outline-2 outline-white shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]",
                  maskShape === "circle" ? "rounded-full" : "rounded-lg",
                  "cursor-move"
                )}
                style={{ left: crop.x, top: crop.y, width: crop.size, height: crop.size }}
                onPointerDown={(e) => {
                  e.preventDefault()
                  ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
                  dragRef.current = { kind: "move", startX: e.clientX, startY: e.clientY, origX: crop.x, origY: crop.y }
                }}
                onPointerMove={(e) => {
                  if (!dragRef.current || dragRef.current.kind !== "move" || !rendered) return
                  const dx = e.clientX - dragRef.current.startX
                  const dy = e.clientY - dragRef.current.startY
                  const nextX = dragRef.current.origX + dx
                  const nextY = dragRef.current.origY + dy

                  // Clamp crop within rendered image bounds
                  const minX = rendered.x
                  const minY = rendered.y
                  const maxX = rendered.x + rendered.w - crop.size
                  const maxY = rendered.y + rendered.h - crop.size
                  setCrop((prev) => ({
                    ...prev,
                    x: clamp(nextX, minX, maxX),
                    y: clamp(nextY, minY, maxY),
                  }))
                }}
                onPointerUp={() => {
                  dragRef.current = null
                }}
              >
                {/* Resize handle (bottom-right) */}
                <div
                  className="absolute -bottom-2 -right-2 h-4 w-4 rounded-sm bg-white shadow cursor-nwse-resize"
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    e.preventDefault()
                    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
                    dragRef.current = {
                      kind: "resize",
                      startX: e.clientX,
                      startY: e.clientY,
                      origSize: crop.size,
                      origX: crop.x,
                      origY: crop.y,
                    }
                  }}
                  onPointerMove={(e) => {
                    if (!dragRef.current || dragRef.current.kind !== "resize" || !rendered) return
                    const dx = e.clientX - dragRef.current.startX
                    const dy = e.clientY - dragRef.current.startY
                    const delta = Math.max(dx, dy)
                    const nextSizeRaw = dragRef.current.origSize + delta

                    // Clamp size within rendered image and minimum
                    const minSize = 64
                    const maxSize = Math.min(
                      rendered.x + rendered.w - dragRef.current.origX,
                      rendered.y + rendered.h - dragRef.current.origY
                    )
                    const nextSize = clamp(nextSizeRaw, minSize, maxSize)
                    setCrop((prev) => ({ ...prev, size: nextSize }))
                  }}
                  onPointerUp={() => {
                    dragRef.current = null
                  }}
                />
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button type="button" onClick={handleApply} disabled={!src || !imgSize}>
              Use photo
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}


