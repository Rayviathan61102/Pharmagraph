// The "Image" topic of a template: pictures of an entity, stored in the database.
import { useQuery } from '@tanstack/react-query'
import { api, uploadImage, useSave, type Entity } from '../api'
import { ErrorText } from '../ui'

type Image = { id: string; media_type: string; created_at: string }

export function EntityImages({ entity, readOnly }: { entity: Entity; readOnly: boolean }) {
  const save = useSave()
  const { data } = useQuery({
    queryKey: ['images', entity.id], queryFn: () => api.get<Image[]>(`/entities/${entity.id}/images`),
  })
  return (
    <div className="entity-images">
      {data?.map((image) => (
        <figure key={image.id}>
          <img src={`/api/images/${image.id}`} alt={`Image of ${entity.name}`} />
          {!readOnly && <button className="link" onClick={() => save.mutate(() => api.post(`/images/${image.id}/archive`))}>Remove</button>}
        </figure>
      ))}
      {data?.length === 0 && <p className="muted">No image yet.</p>}
      {!readOnly && (
        <label className="file-button">Upload image
          <input type="file" accept="image/png,image/jpeg,image/gif,image/webp"
            onChange={(e) => { const file = e.target.files?.[0]; if (file) save.mutate(() => uploadImage(entity.id, file)); e.target.value = '' }} />
        </label>
      )}
      <ErrorText error={save.error} />
    </div>
  )
}
