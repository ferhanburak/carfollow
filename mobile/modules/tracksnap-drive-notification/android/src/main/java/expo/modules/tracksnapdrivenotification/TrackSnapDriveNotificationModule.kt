package expo.modules.tracksnapdrivenotification

import android.app.Notification
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import androidx.core.app.NotificationCompat
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class TrackSnapDriveNotificationModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("TrackSnapDriveNotification")

    AsyncFunction("updateAsync") { title: String, summary: String, details: String ->
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return@AsyncFunction false

      val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      val serviceNotification = manager.activeNotifications.firstOrNull { status ->
        val currentTitle = status.notification.extras
          ?.getCharSequence(Notification.EXTRA_TITLE)
          ?.toString()
          .orEmpty()
        status.notification.category == Notification.CATEGORY_SERVICE
          && currentTitle.startsWith("TrackSnap")
      } ?: return@AsyncFunction false

      val existing = serviceNotification.notification
      val channelId = existing.channelId ?: return@AsyncFunction false
      val notificationIcon = context.resources
        .getIdentifier("notification_icon", "drawable", context.packageName)
        .takeIf { it != 0 }
        ?: context.applicationInfo.icon

      val updated = NotificationCompat.Builder(context, channelId)
        .setSmallIcon(notificationIcon)
        .setContentTitle(title)
        .setContentText(summary)
        .setStyle(NotificationCompat.BigTextStyle().bigText(details))
        .setContentIntent(existing.contentIntent)
        .setCategory(Notification.CATEGORY_SERVICE)
        .setOngoing(true)
        .setOnlyAlertOnce(true)
        .setSilent(true)
        .setShowWhen(true)
        .setWhen(existing.`when`)
        .build()

      manager.notify(serviceNotification.id, updated)
      true
    }
  }
}
