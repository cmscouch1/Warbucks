package com.warbucks.restart

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class RestartControllerTest {

    @Test
    fun toggleOn_attemptsRespring_andReportsSuccess() {
        val executor = FakeRestartExecutor(
            resultsByMethod = mapOf(
                "kill_background_processes" to RestartAttemptResult.Success("kill_background_processes")
            )
        )
        val controller = RestartController(executor)

        val outcome = controller.onToggleChanged(checked = true)

        assertTrue(outcome.attempted)
        assertTrue(outcome.succeeded)
        assertEquals("kill_background_processes", outcome.method)
        assertEquals(listOf("kill_background_processes"), executor.attemptedMethods)
        assertTrue(outcome.message.contains("Respringing via"))
    }

    @Test
    fun toggleOn_triesFallbackMethodsUntilOneSucceeds() {
        val executor = FakeRestartExecutor(
            resultsByMethod = mapOf(
                "kill_background_processes" to RestartAttemptResult.Failure("kill_background_processes", "denied"),
                "force_stop_package" to RestartAttemptResult.Failure("force_stop_package", "denied"),
                "force_stop_systemui" to RestartAttemptResult.Failure("force_stop_systemui", "denied"),
                "killall_systemui" to RestartAttemptResult.Failure("killall_systemui", "denied"),
                "pkill_systemui" to RestartAttemptResult.Failure("pkill_systemui", "denied"),
                "su_force_stop_systemui" to RestartAttemptResult.Success("su_force_stop_systemui")
            )
        )
        val controller = RestartController(executor)

        val outcome = controller.onToggleChanged(checked = true)

        assertTrue(outcome.succeeded)
        assertEquals("su_force_stop_systemui", outcome.method)
        assertEquals(
            listOf(
                "kill_background_processes",
                "force_stop_package",
                "force_stop_systemui",
                "killall_systemui",
                "pkill_systemui",
                "su_force_stop_systemui"
            ),
            executor.attemptedMethods
        )
    }

    @Test
    fun toggleOn_reportsFailureWhenAllMethodsFail() {
        val failures = DeviceRestartExecutor.METHOD_NAMES.associateWith { method ->
            RestartAttemptResult.Failure(method, "denied")
        }
        val executor = FakeRestartExecutor(resultsByMethod = failures)
        val controller = RestartController(executor)

        val outcome = controller.onToggleChanged(checked = true)

        assertTrue(outcome.attempted)
        assertFalse(outcome.succeeded)
        assertTrue(outcome.message.contains("All respring methods failed"))
        assertEquals(DeviceRestartExecutor.METHOD_NAMES, executor.attemptedMethods)
    }

    @Test
    fun toggleOff_doesNotAttemptRespring() {
        val executor = FakeRestartExecutor(resultsByMethod = emptyMap())
        val controller = RestartController(executor)

        val outcome = controller.onToggleChanged(checked = false)

        assertFalse(outcome.attempted)
        assertFalse(outcome.succeeded)
        assertTrue(executor.attemptedMethods.isEmpty())
    }
}

private class FakeRestartExecutor(
    private val resultsByMethod: Map<String, RestartAttemptResult>
) : RestartExecutor {
    val attemptedMethods = mutableListOf<String>()

    override fun attemptAll(): List<RestartAttemptResult> {
        val out = mutableListOf<RestartAttemptResult>()
        for (method in DeviceRestartExecutor.METHOD_NAMES) {
            attemptedMethods += method
            val result = resultsByMethod[method]
                ?: RestartAttemptResult.Failure(method, "unexpected")
            out += result
            if (result is RestartAttemptResult.Success) break
        }
        return out
    }
}
