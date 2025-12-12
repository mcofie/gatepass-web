import React from 'react'

export function Footer() {
    return (
        <footer className="bg-white border-t py-12">
            <div className="container mx-auto px-4 text-center text-gray-400 text-sm">
                <p>&copy; {new Date().getFullYear()} Gatepass. All rights reserved.</p>
            </div>
        </footer>
    )
}
