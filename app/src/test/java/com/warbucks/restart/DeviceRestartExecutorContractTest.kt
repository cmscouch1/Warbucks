package com.warbucks.restart

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class DeviceRestartExecutorContractTest {

    @Test
    fun methodOrder_coversHeadUnitRespringFallbacks() {
        val methods = DeviceRestartExecutor.METHOD_NAMES
        assertEquals(
            listOf(
                "kill_background_processes",
                "force_stop_package",
                "force_stop_systemui",
                "killall_systemui",
                "pkill_systemui",
                "su_force_stop_systemui",
                "su_killall_systemui",
                "su_soft_restart",
                "am_restart"
            ),
            methods
        )
        assertTrue(methods.contains("su_killall_systemui"))
        assertTrue(methods.contains("su_soft_restart"))
    }
}
