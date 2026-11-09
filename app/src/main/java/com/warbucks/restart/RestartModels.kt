package com.warbucks.restart

sealed class RestartAttemptResult {
    abstract val method: String

    data class Success(override val method: String) : RestartAttemptResult()
    data class Failure(override val method: String, val reason: String) : RestartAttemptResult()
}

data class RestartOutcome(
    val attempted: Boolean,
    val succeeded: Boolean,
    val method: String? = null,
    val message: String = ""
)

interface RestartExecutor {
    fun attemptAll(): List<RestartAttemptResult>
}
