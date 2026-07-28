import { ModulePlaceholder } from '@/components/module-placeholder';
import { ScreenShell } from '@/components/screen-shell';

export default function SocialScreen() {
  return (
    <ScreenShell title="Sosyal" subtitle="Arkadaşlar, davetler ve klan merkezi.">
      <ModulePlaceholder
        description="Mevcut arkadaşlık ve klan fonksiyonları, mobil bildirim akışıyla birlikte burada çalışacak."
        icon="people"
        title="Topluluk bağlantıları"
      />
    </ScreenShell>
  );
}
