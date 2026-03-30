'use client'

import React from 'react'
import { createClient } from '@/utils/supabase/client'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { toast } from 'sonner'
import { Loader2, MessageSquare, Zap, ShieldCheck } from 'lucide-react'

export function SMSSettings({ organizer, userRole }: { organizer: any, userRole: string }) {
    if (!organizer) return null

    const [loading, setLoading] = React.useState(false)
    const canEdit = userRole === 'Owner' || userRole === 'Admin'
    
    // Form State
    const [provider, setProvider] = React.useState<'none' | 'hubtel' | 'zend'>(organizer?.sms_provider || 'none')
    const [hubtelId, setHubtelId] = React.useState(organizer?.hubtel_client_id || '')
    const [hubtelSecret, setHubtelSecret] = React.useState(organizer?.hubtel_client_secret || '')
    const [zendKey, setZendKey] = React.useState(organizer?.zend_api_key || '')
    const [senderId, setSenderId] = React.useState(organizer?.sms_sender_id || '')

    const supabase = createClient()

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            const { error } = await supabase
                .schema('gatepass')
                .from('organizers')
                .update({
                    sms_provider: provider,
                    hubtel_client_id: hubtelId,
                    hubtel_client_secret: hubtelSecret,
                    zend_api_key: zendKey,
                    sms_sender_id: senderId
                })
                .eq('id', organizer.id)

            if (error) throw error
            toast.success('SMS settings updated successfully')
        } catch (error: any) {
            toast.error(error.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="max-w-2xl space-y-8 animate-fade-in">
            <div className="bg-white dark:bg-[#111] rounded-3xl border border-gray-100 dark:border-white/10 p-8 shadow-sm">
                <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 bg-amber-500/10 text-amber-500 rounded-2xl flex items-center justify-center">
                        <MessageSquare className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">Bring Your Own Carrier</h3>
                        <p className="text-sm text-gray-500">Connect your Hubtel or Zend account for SMS blasts.</p>
                    </div>
                </div>

                <form onSubmit={handleSave} className="space-y-8">
                    {/* Provider Selection */}
                    <div className="space-y-4">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Choose SMS Provider</label>
                        <div className="grid grid-cols-3 gap-4">
                            {[
                                { id: 'none', name: 'Disabled', icon: ShieldCheck },
                                { id: 'hubtel', name: 'Hubtel', icon: Zap },
                                { id: 'zend', name: 'Zend', icon: MessageSquare }
                            ].map((p) => (
                                <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => setProvider(p.id as any)}
                                    className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all gap-2 ${
                                        provider === p.id 
                                        ? 'border-black dark:border-white bg-black/5 dark:bg-white/5' 
                                        : 'border-transparent bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10'
                                    }`}
                                >
                                    <p.icon className={`w-5 h-5 ${provider === p.id ? 'text-black dark:text-white' : 'text-gray-400'}`} />
                                    <span className={`text-xs font-bold ${provider === p.id ? 'text-black dark:text-white' : 'text-gray-500'}`}>{p.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Common Fields */}
                    {provider !== 'none' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-top-2">
                             <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-900 dark:text-gray-300 ml-1">SMS Sender ID</label>
                                <Input
                                    value={senderId}
                                    onChange={e => setSenderId(e.target.value)}
                                    disabled={!canEdit}
                                    className="h-12 bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 rounded-xl px-4 dark:text-white"
                                    placeholder="e.g. GATEPASS"
                                />
                                <p className="text-[10px] text-gray-400 ml-1">The name that appears on the attendee's phone (limited to 11 chars).</p>
                            </div>

                            {provider === 'hubtel' && (
                                <>
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-gray-900 dark:text-gray-300 ml-1">Hubtel Client ID</label>
                                        <Input
                                            value={hubtelId}
                                            onChange={e => setHubtelId(e.target.value)}
                                            disabled={!canEdit}
                                            className="h-12 bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 rounded-xl px-4 dark:text-white"
                                            placeholder="XXXXXX"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-gray-900 dark:text-gray-300 ml-1">Hubtel Client Secret</label>
                                        <Input
                                            type="password"
                                            value={hubtelSecret}
                                            onChange={e => setHubtelSecret(e.target.value)}
                                            disabled={!canEdit}
                                            className="h-12 bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 rounded-xl px-4 dark:text-white"
                                            placeholder="••••••••"
                                        />
                                    </div>
                                </>
                            )}

                            {provider === 'zend' && (
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-900 dark:text-gray-300 ml-1">Zend API Key</label>
                                    <Input
                                        type="password"
                                        value={zendKey}
                                        onChange={e => setZendKey(e.target.value)}
                                        disabled={!canEdit}
                                        className="h-12 bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 rounded-xl px-4 dark:text-white"
                                        placeholder="zend_auth_..."
                                    />
                                    <p className="text-[10px] text-gray-400 ml-1">Found in your Zend dashboard settings.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {canEdit ? (
                        <div className="pt-4">
                            <Button
                                type="submit"
                                disabled={loading}
                                className="h-12 px-8 bg-black dark:bg-white text-white dark:text-black font-bold rounded-xl hover:bg-gray-800 dark:hover:bg-gray-200 transition-all shadow-xl shadow-black/10 hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98]"
                            >
                                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                Save SMS Configuration
                            </Button>
                        </div>
                    ) : (
                        <div className="pt-4 p-4 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/10 text-center">
                            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium italic">
                                Read-only access: Contact an owner to change carrier settings.
                            </p>
                        </div>
                    )}
                </form>
            </div>

            {/* Hint Box */}
            <div className="bg-amber-50 dark:bg-amber-500/5 rounded-3xl p-8 border border-amber-100 dark:border-amber-500/10">
                <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-amber-500 text-white rounded-xl flex items-center justify-center flex-shrink-0">
                        <MessageSquare className="w-5 h-5" />
                    </div>
                    <div className="space-y-2">
                        <h4 className="font-bold text-amber-900 dark:text-amber-400">Why bring your own token?</h4>
                        <p className="text-sm text-amber-800/70 dark:text-amber-400/60 leading-relaxed">
                            By connecting your personal Hubtel or Zend account, you pay direct carrier rates and have full control over your SMS throughput. GatePass uses these credentials solely to route your attendee blasts through your own account.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
