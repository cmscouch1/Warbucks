package com.warbucks.restart

class RestartController(
    private val executor: RestartExecutor
) {
    fun onToggleChanged(checked: Boolean): RestartOutcome {
        if (!checked) {
            return RestartOutcome(
                attempted = false,
                succeeded = false,
                message = "Respring cancelled"
            )
        }

        val results = executor.attemptAll()
        val success = results.firstOrNull { it is RestartAttemptResult.Success }
        if (success != null) {
            return RestartOutcome(
                attempted = true,
                succeeded = true,
                method = success.method,
                message = "Respringing via ${success.method}"
            )
        }

        val reasons = results
            .filterIsInstance<RestartAttemptResult.Failure>()
            .joinToString("; ") { "${it.method}: ${it.reason}" }

        return RestartOutcome(
            attempted = true,
            succeeded = false,
            message = if (reasons.isBlank()) {
                "All respring methods failed"
            } else {
                "All respring methods failed — $reasons"
            }
        )
    }
}
