'use client'

import React from 'react'
import { cn } from '@/lib/utils'

export interface PhoneInputProps {
    value: string
    onChange: (value: string) => void
    onBlur?: () => void
    placeholder?: string
    className?: string
    error?: boolean
    disabled?: boolean
    id?: string
}

export const COUNTRIES = [
    { code: '+233', flag: '🇬🇭', name: 'Ghana (GH)' },
    { code: '+234', flag: '🇳🇬', name: 'Nigeria (NG)' },
    { code: '+1', flag: '🇺🇸', name: 'United States / Canada (US/CA)' },
    { code: '+44', flag: '🇬🇧', name: 'United Kingdom (GB)' },
    { code: '+254', flag: '🇰🇪', name: 'Kenya (KE)' },
    { code: '+27', flag: '🇿🇦', name: 'South Africa (ZA)' },
    { code: '+225', flag: '🇨🇮', name: 'Côte d’Ivoire (CI)' },
    { code: '+250', flag: '🇷🇼', name: 'Rwanda (RW)' },
    { code: '+256', flag: '🇺🇬', name: 'Uganda (UG)' },
    { code: '+231', flag: '🇱🇷', name: 'Liberia (LR)' },
    { code: '+232', flag: '🇸🇱', name: 'Sierra Leone (SL)' },
    { code: '+221', flag: '🇸🇳', name: 'Senegal (SN)' },
    { code: '+228', flag: '🇹🇬', name: 'Togo (TG)' },
    { code: '+229', flag: '🇧🇯', name: 'Benin (BJ)' },
    { code: '+237', flag: '🇨🇲', name: 'Cameroon (CM)' },
    { code: '+212', flag: '🇲🇦', name: 'Morocco (MA)' },
    { code: '+20', flag: '🇪🇬', name: 'Egypt (EG)' },
    { code: '+33', flag: '🇫🇷', name: 'France (FR)' },
    { code: '+49', flag: '🇩🇪', name: 'Germany (DE)' },
    { code: '+353', flag: '🇮🇪', name: 'Ireland (IE)' },
    { code: '+41', flag: '🇨🇭', name: 'Switzerland (CH)' },
    { code: '+32', flag: '🇧🇪', name: 'Belgium (BE)' },
    { code: '+31', flag: '🇳🇱', name: 'Netherlands (NL)' },
    { code: '+39', flag: '🇮🇹', name: 'Italy (IT)' },
    { code: '+34', flag: '🇪🇸', name: 'Spain (ES)' },
    { code: '+971', flag: '🇦🇪', name: 'United Arab Emirates (AE)' },
    { code: '+966', flag: '🇸🇦', name: 'Saudi Arabia (SA)' },
    { code: '+974', flag: '🇶🇦', name: 'Qatar (QA)' },
    { code: '+91', flag: '🇮🇳', name: 'India (IN)' },
    { code: '+65', flag: '🇸🇬', name: 'Singapore (SG)' },
    { code: '+60', flag: '🇲🇾', name: 'Malaysia (MY)' },
    { code: '+82', flag: '🇰🇷', name: 'South Korea (KR)' },
    { code: '+86', flag: '🇨🇳', name: 'China (CN)' },
    { code: '+81', flag: '🇯🇵', name: 'Japan (JP)' },
    { code: '+61', flag: '🇦🇺', name: 'Australia (AU)' },
    { code: '+55', flag: '🇧🇷', name: 'Brazil (BR)' },
    { code: '+52', flag: '🇲🇽', name: 'Mexico (MX)' },
]

export function parsePhoneNumber(value: string | undefined | null) {
    const cleanValue = (value || '').trim()
    
    // Sort countries by length of country code descending to avoid partial matching (e.g. +233 vs +2)
    const sortedCountries = [...COUNTRIES].sort((a, b) => b.code.length - a.code.length)
    
    for (const country of sortedCountries) {
        if (cleanValue.startsWith(country.code)) {
            return {
                countryCode: country.code,
                localNumber: cleanValue.substring(country.code.length)
            }
        }
    }
    
    // Fallback search for any other country code starting with + followed by 1-4 digits
    if (cleanValue.startsWith('+')) {
        const match = cleanValue.match(/^\+(\d{1,4})/)
        if (match) {
            const code = match[0]
            return {
                countryCode: code,
                localNumber: cleanValue.substring(code.length)
            }
        }
    }
    
    // Default fallback to Ghana +233
    return {
        countryCode: '+233',
        localNumber: cleanValue
    }
}

export function PhoneInput({ value, onChange, onBlur, placeholder, className, error, disabled, id }: PhoneInputProps) {
    const { countryCode, localNumber } = parsePhoneNumber(value)
    
    const hasCountry = COUNTRIES.some(c => c.code === countryCode)
    const displayCountries = hasCountry 
        ? COUNTRIES 
        : [{ code: countryCode, flag: '🌐', name: `Other (${countryCode})` }, ...COUNTRIES]
        
    const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newCode = e.target.value
        // Clean leading zero from local number if any
        const cleanLocal = localNumber.startsWith('0') ? localNumber.substring(1) : localNumber
        onChange(newCode + cleanLocal)
    }
    
    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value
        // Allow only digits (remove non-digits)
        let digits = val.replace(/\D/g, '')
        // Clean leading zero from local number
        if (digits.startsWith('0')) {
            digits = digits.substring(1)
        }
        onChange(countryCode + digits)
    }
    
    return (
        <div className={cn(
            "flex w-full rounded-2xl border border-input bg-transparent text-sm shadow-sm transition-colors focus-within:ring-1 focus-within:ring-ring focus-within:outline-none focus-within:ring-foreground/5",
            "border-border bg-surface/50 focus-within:bg-background focus-within:border-foreground",
            error && "border-red-400/60 ring-2 ring-red-400/20 focus-within:border-red-500 focus-within:ring-red-500",
            disabled && "opacity-50 cursor-not-allowed",
            className
        )}>
            {/* Country Selector dropdown */}
            <div className="flex items-center px-3 border-r border-border bg-black/5 dark:bg-white/5 rounded-l-2xl shrink-0">
                <select
                    value={countryCode}
                    onChange={handleCountryChange}
                    disabled={disabled}
                    className="bg-transparent border-0 text-sm font-semibold text-foreground focus:ring-0 focus:outline-none cursor-pointer pr-1"
                    style={{ WebkitAppearance: 'none', MozAppearance: 'none', appearance: 'none' }}
                >
                    {displayCountries.map(c => (
                        <option key={c.code} value={c.code} className="bg-background text-foreground">
                            {c.flag} {c.code}
                        </option>
                    ))}
                </select>
                <svg className="w-3.5 h-3.5 text-muted-foreground pointer-events-none ml-1 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                </svg>
            </div>
            
            {/* Local number input field */}
            <input
                id={id}
                type="tel"
                value={localNumber}
                onChange={handlePhoneChange}
                onBlur={onBlur}
                disabled={disabled}
                placeholder={placeholder || "20 123 4567"}
                className="flex-1 h-12 px-4 bg-transparent border-0 text-foreground text-[16px] placeholder:text-muted-foreground font-medium focus:ring-0 focus:outline-none rounded-r-2xl"
            />
        </div>
    )
}
