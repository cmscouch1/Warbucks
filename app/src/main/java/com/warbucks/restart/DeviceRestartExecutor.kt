package com.warbucks.restart

import android.app.ActivityManager
import android.content.Context
import java.io.DataOutputStream

/**
 * Respring strategies for Android car head units.
 *
 * A respring restarts System UI / the Android framework so the head-unit screen
 * recovers without a full cold reboot. Order prefers lighter UI kills first,
 * then root variants, then a soft framework restart.
 */
class DeviceRestartExecutor(
    private val context: Context
) : RestartExecutor {

    override fun attemptAll(): List<RestartAttemptResult> {
        val results = mutableListOf<RestartAttemptResult>()
        for (attempt in strategies) {
            val result = attempt()
            results += result
            if (result is RestartAttemptResult.Success) {
                break
            }
        }
        return results
    }

    private val strategies: List<() -> RestartAttemptResult> = listOf(
        ::attemptKillBackgroundProcesses,
        ::attemptForceStopPackageReflect,
        { attemptVerifiedShell("force_stop_systemui", "am force-stop com.android.systemui") },
        { attemptVerifiedShell("killall_systemui", "killall com.android.systemui || killall systemui") },
        { attemptVerifiedShell("pkill_systemui", "pkill -f com.android.systemui") },
        { attemptVerifiedSu("su_force_stop_systemui", "am force-stop com.android.systemui") },
        {
            attemptVerifiedSu(
                "su_killall_systemui",
                "killall com.android.systemui; killall systemui; pkill -f com.android.systemui"
            )
        },
        { attemptSuCommand("su_soft_restart", "setprop ctl.restart zygote", verifyUiDeath = false) },
        { attemptShell("am_restart", "am restart", verifyUiDeath = false) }
    )

    private fun activityManager(): ActivityManager =
        context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager

    private fun systemUiPids(): Set<Int> {
        val fromAm = activityManager().runningAppProcesses
            ?.filter { it.processName.contains("systemui", ignoreCase = true) }
            ?.map { it.pid }
            ?.toSet()
            .orEmpty()
        if (fromAm.isNotEmpty()) return fromAm

        return try {
            val process = ProcessBuilder("sh", "-c", "pidof com.android.systemui systemui")
                .redirectErrorStream(true)
                .start()
            val output = process.inputStream.bufferedReader().readText().trim()
            process.waitFor()
            output.split(Regex("\\s+"))
                .filter { it.isNotBlank() }
                .mapNotNull { it.toIntOrNull() }
                .toSet()
        } catch (_: Exception) {
            emptySet()
        }
    }

    private fun systemUiAppearsStopped(previousPids: Set<Int>): Boolean {
        // Give System UI a brief moment to die / respawn under a new PID.
        Thread.sleep(400)
        val current = systemUiPids()
        if (previousPids.isEmpty()) {
            // Could not observe PIDs beforehand; treat exit-code success alone.
            return true
        }
        return current.isEmpty() || current != previousPids
    }

    private fun attemptKillBackgroundProcesses(): RestartAttemptResult {
        val before = systemUiPids()
        return try {
            activityManager().killBackgroundProcesses(SYSTEM_UI_PACKAGE)
            if (systemUiAppearsStopped(before)) {
                RestartAttemptResult.Success("kill_background_processes")
            } else {
                RestartAttemptResult.Failure(
                    "kill_background_processes",
                    "System UI still running (needs root or privileged install)"
                )
            }
        } catch (error: SecurityException) {
            RestartAttemptResult.Failure("kill_background_processes", error.message ?: "permission denied")
        } catch (error: Exception) {
            RestartAttemptResult.Failure("kill_background_processes", error.message ?: "unknown error")
        }
    }

    private fun attemptForceStopPackageReflect(): RestartAttemptResult {
        val before = systemUiPids()
        return try {
            val method = ActivityManager::class.java.getMethod("forceStopPackage", String::class.java)
            method.invoke(activityManager(), SYSTEM_UI_PACKAGE)
            if (systemUiAppearsStopped(before)) {
                RestartAttemptResult.Success("force_stop_package")
            } else {
                RestartAttemptResult.Failure(
                    "force_stop_package",
                    "System UI still running (needs root or privileged install)"
                )
            }
        } catch (error: SecurityException) {
            RestartAttemptResult.Failure("force_stop_package", error.message ?: "permission denied")
        } catch (error: Exception) {
            RestartAttemptResult.Failure(
                "force_stop_package",
                error.cause?.message ?: error.message ?: "reflection failed"
            )
        }
    }

    private fun attemptVerifiedShell(method: String, command: String): RestartAttemptResult =
        attemptShell(method, command, verifyUiDeath = true)

    private fun attemptVerifiedSu(method: String, command: String): RestartAttemptResult =
        attemptSuCommand(method, command, verifyUiDeath = true)

    private fun attemptShell(
        method: String,
        command: String,
        verifyUiDeath: Boolean
    ): RestartAttemptResult {
        val before = if (verifyUiDeath) systemUiPids() else emptySet()
        return try {
            val process = ProcessBuilder("sh", "-c", command)
                .redirectErrorStream(true)
                .start()
            val output = process.inputStream.bufferedReader().readText().trim()
            val code = process.waitFor()
            if (code != 0) {
                val detail = if (output.isNotEmpty()) output else "exit code $code"
                return RestartAttemptResult.Failure(method, detail)
            }
            if (verifyUiDeath && !systemUiAppearsStopped(before)) {
                return RestartAttemptResult.Failure(method, "System UI still running")
            }
            RestartAttemptResult.Success(method)
        } catch (error: Exception) {
            RestartAttemptResult.Failure(method, error.message ?: "exec failed")
        }
    }

    private fun attemptSuCommand(
        method: String,
        command: String,
        verifyUiDeath: Boolean
    ): RestartAttemptResult {
        val before = if (verifyUiDeath) systemUiPids() else emptySet()
        return try {
            val process = ProcessBuilder("su")
                .redirectErrorStream(true)
                .start()
            DataOutputStream(process.outputStream).use { stream ->
                stream.writeBytes("$command\n")
                stream.writeBytes("exit\n")
                stream.flush()
            }
            val output = process.inputStream.bufferedReader().readText().trim()
            val code = process.waitFor()
            if (code != 0) {
                val detail = if (output.isNotEmpty()) output else "exit code $code (no root?)"
                return RestartAttemptResult.Failure(method, detail)
            }
            if (verifyUiDeath && !systemUiAppearsStopped(before)) {
                return RestartAttemptResult.Failure(method, "System UI still running")
            }
            RestartAttemptResult.Success(method)
        } catch (error: Exception) {
            RestartAttemptResult.Failure(method, error.message ?: "no root")
        }
    }

    companion object {
        const val SYSTEM_UI_PACKAGE = "com.android.systemui"

        val METHOD_NAMES: List<String> = listOf(
            "kill_background_processes",
            "force_stop_package",
            "force_stop_systemui",
            "killall_systemui",
            "pkill_systemui",
            "su_force_stop_systemui",
            "su_killall_systemui",
            "su_soft_restart",
            "am_restart"
        )
    }
}
