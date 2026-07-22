import ClientPage from './ClientPage';

export function generateStaticParams() {
  return [{ token: '1' }];
}

export default function Page({ params }: { params: { token: string } }) {
  return <ClientPage params={params} />;
}
