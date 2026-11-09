package com.warbucks.restart

import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.SwitchCompat
import com.warbucks.restart.databinding.ActivityMainBinding

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var controller: RestartController
    private var handlingProgrammaticToggle = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        controller = RestartController(DeviceRestartExecutor(applicationContext))
        binding.statusText.text = getString(R.string.status_ready)

        binding.restartToggle.setOnCheckedChangeListener { _, isChecked ->
            if (handlingProgrammaticToggle) return@setOnCheckedChangeListener
            handleToggle(isChecked)
        }
    }

    private fun handleToggle(isChecked: Boolean) {
        val outcome = controller.onToggleChanged(isChecked)
        binding.statusText.text = when {
            outcome.message.isNotBlank() -> outcome.message
            isChecked -> getString(R.string.status_restart_requested)
            else -> getString(R.string.status_ready)
        }

        if (isChecked && !outcome.succeeded) {
            setToggleChecked(false)
            Toast.makeText(this, outcome.message, Toast.LENGTH_LONG).show()
        } else if (isChecked && outcome.succeeded) {
            Toast.makeText(this, outcome.message, Toast.LENGTH_SHORT).show()
        }
    }

    private fun setToggleChecked(checked: Boolean) {
        handlingProgrammaticToggle = true
        binding.restartToggle.isChecked = checked
        handlingProgrammaticToggle = false
    }

    /** Used by instrumented tests to inject a fake executor without rebooting. */
    fun setControllerForTesting(testController: RestartController) {
        controller = testController
    }

    fun toggle(): SwitchCompat = binding.restartToggle
}
