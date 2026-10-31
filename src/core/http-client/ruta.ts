/**
 * Codifica un valor dinámico (id, teléfono, slug) como UN segmento de path.
 *
 * Los features deben usarlo siempre: `encodeURIComponent` neutraliza `/`, `?` y `#`. El caso
 * de `.` / `..` lo rechaza el http client (devuelve 400) al comparar el path resultante.
 */
export const segmentoRuta = (valor: string | number): string => encodeURIComponent(String(valor));
