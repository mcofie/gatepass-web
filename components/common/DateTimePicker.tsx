'use client'

import React, { useState, useEffect, useRef } from 'react'
import { format, isValid, parse, set } from 'date-fns'
import { DayPicker } from 'react-day-picker'
import { Calendar as CalendarIcon, Clock, ChevronLeft, ChevronRight } from 'lucide-react'
import 'react-day-picker/dist/style.css'

interface DateTimePickerProps {
    date: Date | undefined
    setDate: (date: Date | undefined) => void
    label?: string
    required?: boolean
}

export function DateTimePicker({ date, setDate, label, required }: DateTimePickerProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(date)
    const [timeValue, setTimeValue] = useState<string>(date ? format(date, 'HH:mm') : '12:00')

    // Update local state when prop changes
    useEffect(() => {
        setSelectedDate(date)
        if (date) {
            setTimeValue(format(date, 'HH:mm'))
        }
    }, [date])

    const containerRef = useRef<HTMLDivElement>(null)

    // Handle clicks outside to close
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const handleDateSelect = (newDate: Date | undefined) => {
        if (!newDate) {
            setSelectedDate(undefined)
            return
        }

        // Preserve existing time or use current time value
        const [hours, minutes] = timeValue.split(':').map(Number)
        const dateWithTime = set(newDate, { hours, minutes })

        setSelectedDate(dateWithTime)
        setDate(dateWithTime)
    }

    const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newTime = e.target.value
        setTimeValue(newTime)

        if (selectedDate) {
            const [hours, minutes] = newTime.split(':').map(Number)
            const newDateTime = set(selectedDate, { hours, minutes })
            setSelectedDate(newDateTime)
            setDate(newDateTime)
        }
    }

    return (
        <div className="relative" ref={containerRef}>
            <div
                onClick={() => setIsOpen(!isOpen)}
                className={`
                    w-full px-4 py-3 bg-gray-50 border rounded-xl flex items-center justify-between cursor-pointer transition-all
                    ${isOpen ? 'ring-2 ring-black border-transparent bg-white' : 'border-gray-200 hover:border-gray-300'}
                `}
            >
                <div className="flex items-center gap-3 text-gray-900">
                    <CalendarIcon className="w-4 h-4 text-gray-500" />
                    <span className={`font-medium ${!date ? 'text-gray-400' : ''}`}>
                        {date ? format(date, 'PPP p') : 'Pick a date and time'}
                    </span>
                </div>
            </div>

            {isOpen && (
                <div className="absolute top-full left-0 mt-2 z-50 bg-white rounded-xl shadow-xl border border-gray-100 p-4 w-full md:w-auto animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex flex-col md:flex-row gap-6">
                        {/* Calendar */}
                        <div className="p-2">
                            <style>{`
                                .rdp { --rdp-cell-size: 40px; --rdp-accent-color: #000000; margin: 0; }
                                .rdp-button:hover:not([disabled]):not(.rdp-day_selected) { background-color: #f3f4f6; }
                                .rdp-day_selected, .rdp-day_selected:focus-visible, .rdp-day_selected:hover { background-color: black; color: white; }
                            `}</style>
                            <DayPicker
                                mode="single"
                                selected={selectedDate}
                                onSelect={handleDateSelect}
                                showOutsideDays
                                className="border-0"
                            />
                        </div>

                        {/* Time Picker Section */}
                        <div className="border-t md:border-t-0 md:border-l border-gray-100 pt-4 md:pt-0 md:pl-6 flex flex-col gap-4 min-w-[200px]">
                            <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                                <Clock className="w-4 h-4" />
                                Select Time
                            </h4>

                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                <label className="text-xs text-gray-500 font-medium mb-1.5 block">Time</label>
                                <input
                                    type="time"
                                    value={timeValue}
                                    onChange={handleTimeChange}
                                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-lg font-bold outline-none focus:ring-2 focus:ring-black/10"
                                />
                                <p className="text-[10px] text-gray-400 mt-2">
                                    Time is in your local timezone.
                                </p>
                            </div>

                            <div className="mt-auto">
                                <button
                                    type="button"
                                    onClick={() => setIsOpen(false)}
                                    className="w-full bg-black text-white py-2.5 rounded-lg font-bold text-sm hover:bg-gray-800 transition-colors"
                                >
                                    Done
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
