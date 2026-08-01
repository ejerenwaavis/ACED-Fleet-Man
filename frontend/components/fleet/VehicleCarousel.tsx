'use client';

import React, { useRef, useEffect, useState } from 'react';

interface Vehicle {
  _id: string;
  truckNumber: string;
  make?: string;
  model?: string;
  routeNumber?: string;
  status?: string;
}

interface Props {
  vehicles: Vehicle[];
  selectedId: string;
  onSelect: (id: string) => void;
}

export function VehicleCarousel({ vehicles, selectedId, onSelect }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const isDown = useRef(false);
  const startX = useRef(0);
  const startScroll = useRef(0);
  const snapTimer = useRef<NodeJS.Timeout | null>(null);
  
  const [activeIndex, setActiveIndex] = useState(0);

  // Sync external selectedId to internal activeIndex on mount or prop change
  useEffect(() => {
    let idx = vehicles.findIndex(v => v._id === selectedId);
    if (selectedId === 'new') idx = vehicles.length;
    
    if (idx >= 0 && idx !== activeIndex) {
      setActiveIndex(idx);
      scrollToIndex(idx, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, vehicles]);

  const updateVisualState = () => {
    if (!viewportRef.current || !trackRef.current) return 0;
    
    const viewport = viewportRef.current;
    const cards = Array.from(trackRef.current.children) as HTMLElement[];
    if (cards.length === 0) return 0;

    const vpRect = viewport.getBoundingClientRect();
    const centerX = vpRect.left + vpRect.width / 2;
    let closestIdx = 0;
    let closestDist = Infinity;

    cards.forEach((card, i) => {
      const r = card.getBoundingClientRect();
      const cardCenter = r.left + r.width / 2;
      const dist = cardCenter - centerX;
      const absDist = Math.abs(dist);
      
      const norm = Math.min(absDist / (vpRect.width / 2.4), 1); // 0 at center, 1 at edge
      const scale = 1 - norm * 0.14;
      const opacity = 1 - norm * 0.72;
      
      card.style.transform = `scale(${scale})`;
      card.style.opacity = opacity.toFixed(2);
      
      if (absDist < 40) {
        card.style.borderColor = 'var(--signal)';
        card.style.boxShadow = '0 6px 18px rgba(59,91,253,0.16)';
      } else {
        card.style.borderColor = 'var(--hairline)';
        card.style.boxShadow = 'none';
      }

      if (absDist < closestDist) {
        closestDist = absDist;
        closestIdx = i;
      }
    });

    return closestIdx;
  };

  const scrollToIndex = (i: number, smooth: boolean) => {
    if (!viewportRef.current || !trackRef.current) return;
    const cards = Array.from(trackRef.current.children) as HTMLElement[];
    if (!cards[i]) return;
    
    const card = cards[i];
    const target = card.offsetLeft + card.offsetWidth / 2 - viewportRef.current.clientWidth / 2;
    viewportRef.current.scrollTo({ left: target, behavior: smooth ? 'smooth' : 'auto' });
  };

  const settle = () => {
    const idx = updateVisualState();
    setActiveIndex(idx);
    scrollToIndex(idx, true);
    if (vehicles[idx] && vehicles[idx]._id !== selectedId) {
      onSelect(vehicles[idx]._id);
    }
  };

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      viewport.scrollLeft += delta;
    };

    const handleScroll = () => {
      requestAnimationFrame(updateVisualState);
      if (snapTimer.current) clearTimeout(snapTimer.current);
      snapTimer.current = setTimeout(() => {
        settle();
      }, 150);
    };

    viewport.addEventListener('wheel', handleWheel, { passive: false });
    viewport.addEventListener('scroll', handleScroll);

    // Initial setup
    requestAnimationFrame(() => {
      scrollToIndex(activeIndex, false);
      updateVisualState();
    });

    const handleResize = () => updateVisualState();
    window.addEventListener('resize', handleResize);

    return () => {
      viewport.removeEventListener('wheel', handleWheel);
      viewport.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
      if (snapTimer.current) clearTimeout(snapTimer.current);
    };
  }, [vehicles]); // re-bind if vehicles change

  // Drag handlers
  const handleDragStart = (x: number) => {
    if (!viewportRef.current) return;
    isDown.current = true;
    startX.current = x;
    startScroll.current = viewportRef.current.scrollLeft;
    viewportRef.current.style.cursor = 'grabbing';
    if (snapTimer.current) clearTimeout(snapTimer.current);
  };

  const handleDragMove = (x: number) => {
    if (!isDown.current || !viewportRef.current) return;
    viewportRef.current.scrollLeft = startScroll.current - (x - startX.current);
  };

  const handleDragEnd = () => {
    if (!isDown.current || !viewportRef.current) return;
    isDown.current = false;
    viewportRef.current.style.cursor = 'grab';
    settle();
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => handleDragMove(e.clientX);
    const onMouseUp = () => handleDragEnd();
    
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    let newIdx = activeIndex;
    if (e.key === 'ArrowRight') newIdx = Math.min(activeIndex + 1, vehicles.length - 1);
    if (e.key === 'ArrowLeft') newIdx = Math.max(activeIndex - 1, 0);
    
    if (newIdx !== activeIndex) {
      setActiveIndex(newIdx);
      scrollToIndex(newIdx, true);
      onSelect(vehicles[newIdx]._id);
    }
  };

  return (
    <div className="relative py-2 -mx-2 px-2">
      {/* Gradients to fade out the edges */}
      <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-[#f1f3f6] dark:from-[var(--bg)] to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-[#f1f3f6] dark:from-[var(--bg)] to-transparent z-10 pointer-events-none" />
      
      <div 
        ref={viewportRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onMouseDown={e => handleDragStart(e.clientX)}
        onTouchStart={e => handleDragStart(e.touches[0].clientX)}
        onTouchMove={e => handleDragMove(e.touches[0].clientX)}
        onTouchEnd={handleDragEnd}
        className="overflow-x-hidden cursor-grab select-none outline-none [-ms-overflow-style:'none'] [scrollbar-width:'none'] [&::-webkit-scrollbar]:hidden"
      >
        <div 
          ref={trackRef}
          className="flex gap-4 px-[calc(50%-110px)] will-change-transform"
        >
          {vehicles.map((v, i) => (
            <div
              key={v._id}
              onClick={() => {
                setActiveIndex(i);
                scrollToIndex(i, true);
                onSelect(v._id);
              }}
              className="shrink-0 w-[220px] bg-[var(--surface)] border border-[var(--hairline)] rounded-xl p-4 cursor-pointer origin-center"
              style={{ transition: 'opacity 0.12s linear, transform 0.12s linear, border-color 0.12s linear, box-shadow 0.12s linear' }}
            >
              <div className="flex items-center justify-between w-full mb-2">
                <span className="font-mono text-xl font-bold text-[var(--ink)]">{v.truckNumber}</span>
                <div className={`w-2.5 h-2.5 rounded-full shadow-sm ${v.status === 'active' ? 'bg-[var(--green)]' : v.status === 'maintenance' ? 'bg-[var(--amber)]' : 'bg-[var(--red)]'}`} title={v.status} />
              </div>
              <div className="text-[13px] font-medium text-[var(--ink-2)] mb-3 leading-tight">{v.make || 'Unknown Make'} {v.model || 'Unknown Model'}</div>
              <div className="inline-block text-[12px] text-[var(--steel)] bg-[var(--canvas)] px-2 py-1 rounded-md">Route {v.routeNumber || 'N/A'}</div>
            </div>
          ))}
          
          {/* Blank Slate / Add New */}
          <div
            key="add-new"
            onClick={() => {
              setActiveIndex(vehicles.length);
              scrollToIndex(vehicles.length, true);
              onSelect('new');
            }}
            className="shrink-0 w-[220px] bg-[var(--canvas)] border border-dashed border-[var(--steel-light)] rounded-xl p-4 cursor-pointer origin-center flex flex-col items-center justify-center text-[var(--steel)] hover:text-[var(--ink)] hover:border-[var(--steel)]"
            style={{ transition: 'opacity 0.12s linear, transform 0.12s linear, border-color 0.12s linear, box-shadow 0.12s linear' }}
          >
            <div className="w-8 h-8 rounded-full bg-[var(--surface)] shadow-sm flex items-center justify-center mb-2">
              <span className="text-xl leading-none font-light">+</span>
            </div>
            <span className="text-sm font-medium">Add New Truck</span>
          </div>
        </div>
      </div>

      <div className="flex justify-center gap-1.5 mt-4">
        {[...vehicles, { _id: 'new' }].map((v, i) => (
          <button
            key={v._id}
            onClick={() => {
              setActiveIndex(i);
              scrollToIndex(i, true);
              onSelect(v._id);
            }}
            className={`h-1.5 rounded-full transition-all duration-150 ${i === activeIndex ? 'w-4 bg-[var(--signal)]' : 'w-1.5 bg-[#d7dbe3] hover:bg-[var(--steel-light)]'}`}
            aria-label={v._id === 'new' ? 'Add New Truck' : `Select vehicle`}
          />
        ))}
      </div>
    </div>
  );
}
