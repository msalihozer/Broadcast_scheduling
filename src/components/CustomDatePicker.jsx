/**
 * @file src/components/CustomDatePicker.jsx
 * @description Türkçe yerel ayarlı (date-fns/locale/tr), açılır takvim seçici bileşeni.
 */
import React, { useState, useRef, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, addMonths, subMonths, setMonth, setYear, isSameMonth, isSameDay, parseISO, isToday } from 'date-fns';
import { tr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';

const CustomDatePicker = ({ selectedDate, onDateChange, children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(parseISO(selectedDate || format(new Date(), 'yyyy-MM-dd')));
  const popoverRef = useRef(null);

  useEffect(() => {
    if (selectedDate) {
      setCurrentMonth(parseISO(selectedDate));
    }
  }, [selectedDate]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePrevMonth = (e) => {
    e.stopPropagation();
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleNextMonth = (e) => {
    e.stopPropagation();
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const handleMonthChange = (e) => {
    setCurrentMonth(setMonth(currentMonth, parseInt(e.target.value)));
  };

  const handleYearChange = (e) => {
    setCurrentMonth(setYear(currentMonth, parseInt(e.target.value)));
  };

  const handleDayClick = (day) => {
    onDateChange(format(day, 'yyyy-MM-dd'));
    setIsOpen(false);
  };

  // Calendar Grid Logic
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const daysInMonth = eachDayOfInterval({ start: startDate, end: endDate });

  const renderHeader = () => {
    const months = Array.from({ length: 12 }, (_, i) => format(setMonth(new Date(), i), 'LLLL', { locale: tr }));
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 10 }, (_, i) => currentYear - 5 + i);

    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <button onClick={handlePrevMonth} style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', padding: '4px', borderRadius: '4px' }} onMouseEnter={e => e.target.style.background='var(--bg-tertiary)'} onMouseLeave={e => e.target.style.background='transparent'}>
          <ChevronLeft size={18} />
        </button>
        <div style={{ display: 'flex', gap: '8px' }}>
          <select 
            value={currentMonth.getMonth()} 
            onChange={handleMonthChange}
            style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '4px 8px', fontSize: '13px', outline: 'none', cursor: 'pointer', textTransform: 'capitalize' }}
          >
            {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <select 
            value={currentMonth.getFullYear()} 
            onChange={handleYearChange}
            style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '4px 8px', fontSize: '13px', outline: 'none', cursor: 'pointer' }}
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <button onClick={handleNextMonth} style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', padding: '4px', borderRadius: '4px' }} onMouseEnter={e => e.target.style.background='var(--bg-tertiary)'} onMouseLeave={e => e.target.style.background='transparent'}>
          <ChevronRight size={18} />
        </button>
      </div>
    );
  };

  const renderDaysOfWeek = () => {
    const weekDays = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '8px' }}>
        {weekDays.map(day => (
          <div key={day} style={{ textAlign: 'center', fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)' }}>
            {day}
          </div>
        ))}
      </div>
    );
  };

  const renderCells = () => {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
        {daysInMonth.map((day) => {
          const isSelected = selectedDate ? isSameDay(day, parseISO(selectedDate)) : false;
          const isCurrentMonth = isSameMonth(day, monthStart);
          const isTodayDate = isToday(day);

          return (
            <div 
              key={day.toString()} 
              onClick={() => handleDayClick(day)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                height: '32px', width: '32px', borderRadius: '50%',
                fontSize: '13px', fontWeight: isSelected ? 'bold' : 'normal',
                cursor: 'pointer',
                background: isSelected ? 'var(--accent-primary)' : (isTodayDate ? 'rgba(59, 130, 246, 0.2)' : 'transparent'),
                color: isSelected ? '#fff' : (isCurrentMonth ? 'var(--text-primary)' : 'var(--text-muted)'),
                opacity: isCurrentMonth ? 1 : 0.4,
                border: isTodayDate && !isSelected ? '1px solid var(--accent-primary)' : '1px solid transparent',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => { if(!isSelected) e.target.style.background = 'var(--bg-tertiary)'; }}
              onMouseLeave={(e) => { if(!isSelected) e.target.style.background = isTodayDate ? 'rgba(59, 130, 246, 0.2)' : 'transparent'; }}
            >
              {format(day, 'd')}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div style={{ position: 'relative' }} ref={popoverRef}>
      <div onClick={() => setIsOpen(!isOpen)} style={{ display: 'inline-block', cursor: 'pointer' }}>
        {children}
      </div>
      
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          marginTop: '8px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '16px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
          zIndex: 1000,
          width: 'max-content',
          minWidth: '260px'
        }}>
          {renderHeader()}
          {renderDaysOfWeek()}
          {renderCells()}
          
          <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <button 
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (selectedDate) {
                  try {
                    setCurrentMonth(parseISO(selectedDate));
                  } catch (err) {}
                }
              }}
              style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-secondary)', padding: '5px 10px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              <CalendarIcon size={13} /> Aktif Tarih
            </button>
            <button 
              type="button"
              onClick={(e) => { e.stopPropagation(); onDateChange(format(new Date(), 'yyyy-MM-dd')); setIsOpen(false); }}
              style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.25)', borderRadius: '6px', color: 'var(--accent-primary)', padding: '5px 10px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              <CalendarIcon size={13} /> Bugüne Git
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomDatePicker;
