import { ChangeEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { OrderFile } from '../lib/types'

const isImage = (n: string) => /\.(png|jpe?g|gif|webp|heic)$/i.test(n)

export default function AttachmentGrid({ orderId }: { orderId: string }) {
  const qc = useQueryClient()
  const { data } = useQuery({
    queryKey: ['files', orderId],
    queryFn: async () => {
      const { data, error } = await supabase.from('order_files').select('*').eq('order_id', orderId).order('created_at')
      if (error) throw error
      const files = data as OrderFile[]
      const { data: signed } = await supabase.storage.from('order-files').createSignedUrls(files.map((f) => f.path), 3600)
      return files.map((f, i) => ({ ...f, url: signed?.[i]?.signedUrl ?? '' }))
    },
  })

  async function upload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const { data: u } = await supabase.auth.getUser()
    const path = `${u.user!.id}/${orderId}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, '_')}`
    const up = await supabase.storage.from('order-files').upload(path, file)
    if (up.error) return alert(up.error.message)
    await supabase.from('order_files').insert({ order_id: orderId, path, name: file.name })
    qc.invalidateQueries({ queryKey: ['files', orderId] })
  }

  async function remove(f: OrderFile) {
    if (!confirm(`Delete ${f.name}?`)) return
    await supabase.storage.from('order-files').remove([f.path])
    await supabase.from('order_files').delete().eq('id', f.id)
    qc.invalidateQueries({ queryKey: ['files', orderId] })
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
        {data?.map((f) => (
          <div key={f.id} className="relative border rounded-lg overflow-hidden bg-slate-50">
            <a href={f.url} target="_blank" rel="noreferrer" className="block aspect-square">
              {isImage(f.name)
                ? <img src={f.url} alt={f.name} className="w-full h-full object-cover" />
                : <span className="flex h-full items-center justify-center p-1 text-xs text-center break-all">{f.name}</span>}
            </a>
            <button onClick={() => remove(f)} aria-label="Delete file"
              className="absolute top-0 right-0 min-h-[44px] min-w-[44px] bg-white/80 text-red-600">✕</button>
          </div>
        ))}
      </div>
      <label className="inline-flex items-center min-h-[44px] px-4 rounded-lg bg-slate-100 font-medium cursor-pointer">
        + Add file
        <input type="file" accept="image/*,application/pdf" className="hidden" onChange={upload} />
      </label>
    </div>
  )
}
