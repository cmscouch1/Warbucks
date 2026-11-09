package com.warbucks.restart

import androidx.test.ext.junit.rules.ActivityScenarioRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.LargeTest
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
@LargeTest
class MainActivityToggleTest {

    @get:Rule
    val activityRule = ActivityScenarioRule(MainActivity::class.java)

    @Test
    fun toggleOn_withSuccessfulExecutor_staysChecked() {
        activityRule.scenario.onActivity { activity ->
            activity.setControllerForTesting(
                RestartController(
                    object : RestartExecutor {
                        override fun attemptAll(): List<RestartAttemptResult> {
                            return listOf(RestartAttemptResult.Success("test_success"))
                        }
                    }
                )
            )
            activity.toggle().isChecked = true
            assertTrue(activity.toggle().isChecked)
        }
    }

    @Test
    fun toggleOn_withFailingExecutor_resetsToOff() {
        activityRule.scenario.onActivity { activity ->
            activity.setControllerForTesting(
                RestartController(
                    object : RestartExecutor {
                        override fun attemptAll(): List<RestartAttemptResult> {
                            return listOf(
                                RestartAttemptResult.Failure("force_stop_systemui", "denied")
                            )
                        }
                    }
                )
            )
            activity.toggle().isChecked = true
            assertFalse(activity.toggle().isChecked)
        }
    }
}
