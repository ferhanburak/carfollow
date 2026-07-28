import { ModulePlaceholder } from '@/components/module-placeholder';
import { ScreenShell } from '@/components/screen-shell';

export default function LiveMapScreen() {
  return (
    <ScreenShell title="Canlı Harita" subtitle="Sürüş sırasında gerçek konum ve çevrendeki sürücüler.">
      <ModulePlaceholder
        description="Arkadaş, klan ve diğer sürücü işaretleri mobil konum izinleriyle birlikte bu ekrana taşınacak."
        icon="navigate"
        title="Canlı konum katmanı hazırlanıyor"
      />
    </ScreenShell>
  );
}
