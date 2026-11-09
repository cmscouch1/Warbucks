package com.warbucks.restart

import android.widget.TextView
import androidx.appcompat.widget.SwitchCompat
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [30])
class MainActivityRobolectricTest {

    @Test
    fun launch_showsReadyStatusAndToggleOff() {
        val activity = Robolectric.buildActivity(MainActivity::class.java).setup().get()
        val toggle = activity.findViewById<SwitchCompat>(R.id.restartToggle)
        val status = activity.findViewById<TextView>(R.id.statusText)

        assertFalse(toggle.isChecked)
        assertEquals("Ready", status.text.toString())
    }

    @Test
    fun toggleOn_whenRespringFails_resetsToggleAndShowsError() {
        val activity = Robolectric.buildActivity(MainActivity::class.java).setup().get()
        activity.setControllerForTesting(
            RestartController(
                object : RestartExecutor {
                    override fun attemptAll(): List<RestartAttemptResult> {
                        return listOf(
                            RestartAttemptResult.Failure("force_stop_systemui", "permission denied")
                        )
                    }
                }
            )
        )

        val toggle = activity.findViewById<SwitchCompat>(R.id.restartToggle)
        toggle.isChecked = true

        assertFalse(toggle.isChecked)
        assertTrue(
            activity.findViewById<TextView>(R.id.statusText).text.toString()
                .contains("All respring methods failed")
        )
    }

    @Test
    fun toggleOn_whenRespringSucceeds_keepsToggleOn() {
        val activity = Robolectric.buildActivity(MainActivity::class.java).setup().get()
        activity.setControllerForTesting(
            RestartController(
                object : RestartExecutor {
                    override fun attemptAll(): List<RestartAttemptResult> {
                        return listOf(RestartAttemptResult.Success("su_killall_systemui"))
                    }
                }
            )
        )

        val toggle = activity.findViewById<SwitchCompat>(R.id.restartToggle)
        toggle.isChecked = true

        assertTrue(toggle.isChecked)
        assertEquals(
            "Respringing via su_killall_systemui",
            activity.findViewById<TextView>(R.id.statusText).text.toString()
        )
    }
}
