/**
 * The hand-drawn wobbly double-stroke frame (9-slice border-image) — the
 * signature "sheet of paper" surface used on /try and the gallery's quick
 * create box. One source so every framed sheet speaks the same line.
 */

export const WOBBLY_FRAME: React.CSSProperties = {
  border: '18px solid transparent',
  borderImage: `url("data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='160'%20height='160'%20viewBox='0%200%20160%20160'%3E%3Cpath%20d='M%2010%2014%20Q%2044%209%2080%2011%20Q%20116%2013%20150%2011%20Q%20152%2046%20150%2080%20Q%20149%20114%20151%20146%20Q%20116%20151%2080%20149%20Q%2045%20147%2012%20150%20Q%208%20115%2010%2080%20Q%2011%2046%2010%2014%20Z'%20fill='none'%20stroke='%232E2B33'%20stroke-width='3.2'%20stroke-linecap='round'%20stroke-linejoin='round'/%3E%3Cpath%20d='M%2022%2025%20Q%2050%2021%2080%2023%20Q%20110%2024%20138%2023%20Q%20140%2051%20139%2080%20Q%20138%20108%20139%20137%20Q%20110%20140%2080%20138%20Q%2051%20137%2023%20138%20Q%2021%20109%2022%2080%20Q%2023%2052%2022%2025%20Z'%20fill='none'%20stroke='%23B5A8D0'%20stroke-width='1.6'%20opacity='0.65'/%3E%3C/svg%3E") 34 round`,
  background: 'rgba(255, 255, 255, 0.72)',
};
